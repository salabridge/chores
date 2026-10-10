<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { workloadFixture } from './fixtures.ts';
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
