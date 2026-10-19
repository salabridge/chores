<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './CompletionCelebration.stories.svelte';
	import CompletionCelebration from './CompletionCelebration.svelte';
	import {
		favourCompletion,
		favourPendingCompletion,
		goalReachedCompletion,
		roomCompletion,
		toiletCompletion,
	} from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Chores/CompletionCelebration',
		component: CompletionCelebration,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: {
			summary: toiletCompletion,
			backHref: '#',
		},
	});
</script>

<Story name="Shared rotation" />

<Story name="Personal chore" args={{ summary: roomCompletion }} />

<Story name="Goal reached" args={{ summary: goalReachedCompletion }} />

<Story name="Did it for someone" args={{ summary: favourCompletion }} />

<Story name="Favour waiting for approval" args={{ summary: favourPendingCompletion }} />

<Story
	name="Rotation with nobody next"
	args={{
		summary: { ...toiletCompletion, rotation: { nextName: null, nextIsYou: false } },
	}}
/>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
