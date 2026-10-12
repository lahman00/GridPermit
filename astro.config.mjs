// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { buildSitemapPolicy, sitemapPathname } from './src/lib/sitemap-policy.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const sitemapPolicy = buildSitemapPolicy(repoRoot);

// https://astro.build/config
export default defineConfig({
	site: 'https://mygridpermit.com',
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !sitemapPolicy.emptyStatePaths.has(sitemapPathname(page)),
			serialize: (item) => {
				const lastmod = sitemapPolicy.lastmodByPath.get(sitemapPathname(item.url));
				return lastmod ? { ...item, lastmod } : item;
			},
		}),
	],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
