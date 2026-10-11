<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { workloadFixture } from './fixtures.ts';
	import * as thisFile from './MemberWorkloadPanel.stories.svelte';
	import MemberWorkloadPanel from './MemberWorkloadPanel.svelte';

	const { Story } = defineMeta({
		title: 'Overview/MemberWorkloadPanel',
		component: MemberWorkloadPanel,
		tags: ['autodocs'],
		args: { workload: workloadFixture },
	});
</script>


<Story name="Balanced" />

<Story
	name="Unbalanced"
	args={{
		workload: {
			balance: 'unbalanced',
			members: [
				{
					memberId: 'leo',
					name: 'Leo',
					active: 5,
					done: 0,
					summary: 'A, B and 3 more in progress.',
					barPercent: 100,
				},
				{
					memberId: 'dad',
					name: 'Dad',
					active: 0,
					done: 0,
					summary: 'Nothing assigned today.',
					barPercent: 0,
				},
			],
		},
	}}
/>

<Story name="No members" args={{ workload: { balance: 'balanced', members: [] } }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
