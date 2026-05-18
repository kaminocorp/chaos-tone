import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
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
