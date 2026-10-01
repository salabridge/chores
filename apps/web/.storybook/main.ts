import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(js|ts|svelte)'],
	addons: [
		'@storybook/addon-svelte-csf',
		'@storybook/addon-docs',
		'@storybook/addon-a11y',
	],
	framework: '@storybook/sveltekit',
	staticDirs: ['../static'],
	viteFinal: (config) => {
		// Remote function files import server code, so stories get mocks instead.
		const remoteMocks = [
			{
				find: /^#lib\/profiles\.remote\.js$/,
				replacement: fileURLToPath(
					new URL('./mocks/profiles-remote.ts', import.meta.url),
				),
			},
		];
		const alias = config.resolve?.alias ?? [];
		config.resolve = {
			...config.resolve,
			alias: Array.isArray(alias)
				? [...remoteMocks, ...alias]
				: [
						...remoteMocks,
						...Object.entries(alias).map(([find, replacement]) => ({
							find,
							replacement,
						})),
					],
		};
		return config;
	},
};

export default config;
