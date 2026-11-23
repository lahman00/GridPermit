import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inlineEntryStyles } from '../scripts/inline-entry-styles.mjs';

test('entry styles preserve exact CSS and leave guide/cacheable assets intact; repeat build is idempotent', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gridpermit-inline-'));
  try {
    await mkdir(path.join(root, '_astro'));
    await mkdir(path.join(root, 'solar-project-organizer'));
    await mkdir(path.join(root, 'guide'));
    const css = 'body{color:#181818}h1[data-astro-cid-a]{font-size:40px}.literal::before{content:"$&"}';
    const html = '<head><link rel="stylesheet" href="/_astro/base.css"></head><h1 data-astro-cid-a>Solar</h1>';
    await writeFile(path.join(root, '_astro/base.css'), css);
    for (const page of ['index.html', 'solar-project-organizer/index.html', 'guide/index.html']) await writeFile(path.join(root, page), html);
    assert.deepEqual((await inlineEntryStyles(root)).map(x => x.inlined), [1, 1]);
    assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), html.replace('<link rel="stylesheet" href="/_astro/base.css">', () => `<style>${css}</style>`));
    assert.equal(await readFile(path.join(root, 'guide/index.html'), 'utf8'), html);
    assert.equal(await readFile(path.join(root, '_astro/base.css'), 'utf8'), css);
    assert.deepEqual((await inlineEntryStyles(root)).map(x => x.inlined), [0, 0]);
    await writeFile(path.join(root, 'index.html'), html);
    await writeFile(path.join(root, '_astro/base.css'), '</style><script>bad</script>');
    await assert.rejects(inlineEntryStyles(root), /Unsafe style terminator/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
