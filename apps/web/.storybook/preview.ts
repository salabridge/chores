import type { Preview } from '@storybook/sveltekit';
import '../src/routes/layout.css';

const preview: Preview = {
	globalTypes: {
		theme: {
			description: 'Colour theme (sets data-theme on <html>)',
			toolbar: {
				title: 'Theme',
				icon: 'contrast',
				items: [
					{ value: 'system', title: 'System' },
					{ value: 'light', title: 'Light' },
					{ value: 'dark', title: 'Dark' },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: { theme: 'system' },
	decorators: [
		(story, context) => {
			const { theme } = context.globals;
			if (theme === 'light' || theme === 'dark') {
				document.documentElement.dataset.theme = theme;
			} else {
				delete document.documentElement.dataset.theme;
			}
			return story();
		},
	],
	parameters: {
		layout: 'padded',
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		a11y: { test: 'todo' },
	},
};

export default preview;
