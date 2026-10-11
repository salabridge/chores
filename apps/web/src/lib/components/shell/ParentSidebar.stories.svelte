<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ParentSidebar.stories.svelte';
	import ParentSidebar from './ParentSidebar.svelte';

	const { Story } = defineMeta({
		title: 'Shell/ParentSidebar',
		component: ParentSidebar,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { pathname: '/overview', parentNames: ['Mom', 'Dad'] },
	});
</script>

<Story name="Overview active" />

<Story name="Create & Assign active" args={{ pathname: '/chores/new' }} />

<Story name="Rotation Builder active" args={{ pathname: '/rotations' }} />

<Story name="Single parent" args={{ parentNames: ['Sam'] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
