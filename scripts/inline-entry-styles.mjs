import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep CSS inside the first response on these two entry pages. All other pages
// retain the shared cacheable CSS files. Inline the exact built CSS, never a
// guessed critical subset or a later stylesheet swap that can shift the layout.
export async function inlineEntryStyles(distRoot) {
  const root = await realpath(distRoot);
  const results = [];
  for (const entry of ['index.html', 'solar-project-organizer/index.html']) {
    const file = path.join(root, entry);
    let html = await readFile(file, 'utf8');
    const links = [...html.matchAll(/<link rel="stylesheet" href="(\/_astro\/[^"?#]+\.css)">/g)];
    for (const [tag, href] of links) {
      const cssFile = await realpath(path.join(root, href.slice(1)));
      if (!cssFile.startsWith(path.join(root, '_astro') + path.sep)) throw new Error('Stylesheet outside build assets');
      const css = await readFile(cssFile, 'utf8');
      if (/<\/style/i.test(css)) throw new Error('Unsafe style terminator in built CSS');
      html = html.replace(tag, () => `<style>${css}</style>`);
    }
    if (/<link\b[^>]*rel="stylesheet"/i.test(html)) throw new Error(`Unprocessed stylesheet on ${entry}`);
    if (links.length) await writeFile(file, html);
    results.push({ page: entry, inlined: links.length });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  console.log('Entry-page styles:', JSON.stringify(await inlineEntryStyles(root)));
}
