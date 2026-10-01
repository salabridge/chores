<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SegmentedStageProgress from './SegmentedStageProgress.svelte';

	const { Story } = defineMeta({
		title: 'UI/SegmentedStageProgress',
		component: SegmentedStageProgress,
		tags: ['autodocs'],
		argTypes: {
			done: { control: { type: 'range', min: 0, max: 6, step: 1 } },
			total: { control: { type: 'range', min: 1, max: 6, step: 1 } },
		},
		args: {
			title: 'Room Clean Progress',
			description: 'Stage 2 of 3 is active right now',
			total: 3,
			done: 1,
		},
	});
</script>

<Story name="In progress" />

<Story
	name="Not started"
	args={{ done: 0, description: 'Stage 1 of 3 is up next' }}
/>

<Story name="Complete" args={{ done: 3, description: 'All stages done' }} />
