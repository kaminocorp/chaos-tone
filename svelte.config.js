import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Mini currently runs Node 23; pin a supported Vercel runtime.
			runtime: 'nodejs22.x'
		}),
		alias: {
			$features: 'src/lib/features',
			$stores: 'src/lib/stores'
		}
	},
	compilerOptions: {
		runes: true
	}
};

export default config;
