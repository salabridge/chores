<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import * as thisFile from './LegalPage.stories.svelte';
	import LegalPage from './LegalPage.svelte';

	const { Story } = defineMeta({
		title: 'Legal/LegalPage',
		component: LegalPage,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { title: 'Privacy Policy', lastUpdated: '30 October 2026' },
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<LegalPage title={args.title} lastUpdated={args.lastUpdated}>
			<p>
				This is the intro paragraph. It explains what the page is for and who
				it applies to.
			</p>
			<h2>A section heading</h2>
			<p>Body text that wraps over a few lines so the line length is visible.</p>
			<ul>
				<li><strong>Item one:</strong> with a short explanation.</li>
				<li><strong>Item two:</strong> with another short explanation.</li>
			</ul>
		</LegalPage>
	{/snippet}
</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={responsiveVisualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
