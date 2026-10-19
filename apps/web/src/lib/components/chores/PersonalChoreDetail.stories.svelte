<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import {
		doerOptions,
		roomDetail,
		roomDone,
		roomDoneFavour,
		roomFavour,
		roomLastStage,
		roomReadOnly,
		singleStepDetail,
	} from './fixtures.ts';
	import * as thisFile from './PersonalChoreDetail.stories.svelte';
	import PersonalChoreDetail from './PersonalChoreDetail.svelte';

	const { Story } = defineMeta({
		title: 'Chores/PersonalChoreDetail',
		component: PersonalChoreDetail,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: {
			detail: roomDetail,
			onstagedone: fn(),
		},
	});
</script>

<Story name="Middle stage" />

<Story name="Last stage" args={{ detail: roomLastStage }} />

<Story name="Single step" args={{ detail: singleStepDetail }} />

<Story name="Someone else's chore" args={{ detail: roomReadOnly }} />

<Story name="Doing it for someone" args={{ detail: roomFavour }} />

<Story
	name="Parent records who did it"
	args={{ detail: roomFavour, doerOptions }}
/>

<Story name="Done by someone else" args={{ detail: roomDoneFavour }} />

<Story name="Done for now" args={{ detail: roomDone }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
