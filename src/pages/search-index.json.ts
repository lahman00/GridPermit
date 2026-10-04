import type { APIRoute } from 'astro';
import { getAllBlogPosts } from '../lib/blog-posts';
import { buildCountyHubs, type ReadyEvaluationSummary } from '../lib/county-hub';
import { buildLocalityIndexEntries, type EvaluationRecordSummary, type LocalityRecord } from '../lib/locality-guide';
import { buildSearchIndex } from '../lib/search-index';
import { STATE_META, SUPPORTED_STATE_CODES } from '../lib/state-meta';
import { buildUtilityHubs } from '../lib/utility-hub';

export const prerender = true;

export const GET: APIRoute = async () => {
  const localityModules = import.meta.glob('../../data/localities/*.json', { eager: true }) as Record<string, { default: LocalityRecord }>;
  const evaluationModules = import.meta.glob('../../output/*-evaluation.json', { eager: true }) as Record<string, { default: { records: Array<ReadyEvaluationSummary & EvaluationRecordSummary> } }>;
  const recordsById = new Map(Object.values(localityModules).map(mod => [mod.default.record_id, mod.default]));
  const evaluated = Object.values(evaluationModules).flatMap(mod => mod.default.records);
  const localityEntries = buildLocalityIndexEntries(evaluated, recordsById);
  const [blogPosts] = await Promise.all([getAllBlogPosts()]);
  const countyHubs = buildCountyHubs(evaluated, recordsById).filter(hub => hub.state === 'CA');
  const utilityHubs = buildUtilityHubs(evaluated, recordsById).filter(hub => hub.state === 'CA');
  const index = buildSearchIndex({ localityEntries, blogPosts, countyHubs, utilityHubs, states: SUPPORTED_STATE_CODES.map(code => STATE_META[code]) });
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
