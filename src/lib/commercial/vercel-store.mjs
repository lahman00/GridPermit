import {createHmac, randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {RETENTION_MS} from './outbound-service.mjs';

const allowedKey = /^(?:events\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{4}|control\/(?:retention|destinations))$/;
export const CLEANUP_LOCK_SCHEMA = `CREATE TABLE IF NOT EXISTS gridpermit_outbound_locks (key text PRIMARY KEY, token text NOT NULL, expires_at timestamptz NOT NULL)`;
export const RATE_LIMIT_SCHEMA = `CREATE TABLE IF NOT EXISTS gridpermit_outbound_rate_limits (
  key text PRIMARY KEY,
  hits timestamptz[] NOT NULL,
  expires_at timestamptz NOT NULL
)`;
export const STORAGE_SCHEMA = `CREATE TABLE IF NOT EXISTS gridpermit_outbound_v1 (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz,
  CHECK ((key LIKE 'events/%' AND expires_at IS NOT NULL) OR
         (key IN ('control/retention','control/destinations') AND expires_at IS NULL))
)`;

// Neon SQL-over-HTTP uses the database's writer endpoint for strong reads.
export function createNeonStore({connectionString, fetchImpl = fetch, clock = Date.now} = {}) {
  const database = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.username || !database.password || !database.hostname.endsWith('.neon.tech')) throw new Error('STORAGE_CONFIGURATION_INVALID');
  const endpoint = `https://${database.hostname.replace(/^[^.]+\./, 'api.')}/sql`;
  function key(name) {
    if (!allowedKey.test(name)) throw new Error('STORAGE_KEY_INVALID');
    return name;
  }
  async function query(sql, params = []) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Neon-Connection-String': connectionString, 'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'true'},
      body: JSON.stringify({query: sql, params}),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('STORAGE_REQUEST_FAILED');
    const result = await response.json();
    if (!Array.isArray(result.rows) || result.error) throw new Error('STORAGE_COMMAND_FAILED');
    return result;
  }
  return {
    async get(name) {
      const result = await query('SELECT value FROM gridpermit_outbound_v1 WHERE key = $1 AND (expires_at IS NULL OR expires_at > now())', [key(name)]);
      return result.rows.length ? JSON.parse(result.rows[0][0]) : null;
    },
    async setJSON(name, value, options = {}) {
      let expiresAt = null;
      if (name.startsWith('events/')) {
        const milliseconds = Date.parse(value.timestamp) + RETENTION_MS;
        if (!Number.isFinite(milliseconds) || milliseconds <= clock()) throw new Error('EVENT_EXPIRY_INVALID');
        expiresAt = new Date(milliseconds).toISOString();
      }
      const conflict = options.onlyIfNew ? 'DO NOTHING' : 'DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at';
      const result = await query(`INSERT INTO gridpermit_outbound_v1 (key,value,expires_at) VALUES ($1,$2::jsonb,$3::timestamptz) ON CONFLICT (key) ${conflict} RETURNING key`, [key(name), JSON.stringify(value), expiresAt]);
      return {created: result.rows.length === 1};
    },
    async delete(name) {
      await query('DELETE FROM gridpermit_outbound_v1 WHERE key = $1', [key(name)]);
    },
    async deleteExpired() {
      await query('DELETE FROM gridpermit_outbound_rate_limits WHERE expires_at <= now()');
      return query('DELETE FROM gridpermit_outbound_v1 WHERE expires_at <= now() RETURNING key');
    },
    async acquireCleanupLock() {
      const token = randomUUID();
      const result = await query(`INSERT INTO gridpermit_outbound_locks (key,token,expires_at)
        VALUES ('retention', $1, now() + interval '2 minutes')
        ON CONFLICT (key) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
        WHERE gridpermit_outbound_locks.expires_at <= now() RETURNING token`, [token]);
      return result.rows[0]?.[0] === token ? token : null;
    },
    async releaseCleanupLock(token) {
      await query("DELETE FROM gridpermit_outbound_locks WHERE key = 'retention' AND token = $1", [token]);
    },
    async consumeRateLimit(digest) {
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('RATE_LIMIT_KEY_INVALID');
      // The row lock makes concurrent requests share one rolling 60-second window.
      // Keep at most eleven timestamps, including the request that exceeded ten.
      const result = await query(`INSERT INTO gridpermit_outbound_rate_limits (key,hits,expires_at)
        VALUES ($1, ARRAY[now()], now() + interval '2 minutes')
        ON CONFLICT (key) DO UPDATE SET
          hits = ARRAY(SELECT hit FROM unnest(gridpermit_outbound_rate_limits.hits) hit
                       WHERE hit > now() - interval '60 seconds' ORDER BY hit DESC LIMIT 10) || now(),
          expires_at = now() + interval '2 minutes'
        RETURNING cardinality(hits) <= 10`, [digest]);
      if (result.rows.length !== 1 || !['t','f'].includes(result.rows[0][0])) throw new Error('RATE_LIMIT_UNCONFIRMED');
      return result.rows[0][0] === 't';
    },
    async *list({prefix}) {
      if (prefix !== 'events/') throw new Error('STORAGE_PREFIX_INVALID');
      let after = '';
      for (;;) {
        const result = await query("SELECT key FROM gridpermit_outbound_v1 WHERE key LIKE 'events/%' AND key > $1 ORDER BY key LIMIT 200", [after]);
        if (!result.rows.length) return;
        const blobs = result.rows.map(([name]) => ({key: key(name)}));
        yield {blobs};
        after = blobs.at(-1).key;
      }
    },
  };
}
export function getVercelStore(env = process.env) {
  return createNeonStore({connectionString: env.GRIDPERMIT_DATABASE_URL});
}

export async function checkRateLimit(request, env, store, scope) {
  const ip = request.headers.get('x-forwarded-for')?.trim();
  if (!ip || !isIP(ip) || !env.CRON_SECRET || env.CRON_SECRET.length < 32) throw new Error('RATE_LIMIT_CONFIGURATION');
  const digest = createHmac('sha256', env.CRON_SECRET).update(new URL(request.url).hostname + '|' + scope + '|' + ip).digest('hex');
  return store.consumeRateLimit(digest);
}
