<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import VisualTestPage from './VisualTestPage.svelte';

	// The only story Chromatic snapshots (everything else is opted out in
	// .storybook/preview.ts). It renders every story in the app on one page,
	// in light and dark, so one baseline covers every component state. The wide
	// viewport fits more stories per row and keeps the snapshot shorter.
	const { Story } = defineMeta({
		title: 'Visual Test',
		tags: ['visual-test'],
		parameters: {
			layout: 'padded',
			chromatic: {
				disableSnapshot: false,
				modes: {
					light: { theme: 'light', viewport: 1600 },
					dark: { theme: 'dark', viewport: 1600 },
				},
			},
		},
	});
</script>

<Story name="All stories">
	{#snippet template(_args, context)}
		<VisualTestPage theme={context.globals.theme} />
	{/snippet}
</Story>
