<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { dishwasherLoop, toiletLoop } from './fixtures.ts';
	import * as thisFile from './RotationLoopCard.stories.svelte';
	import RotationLoopCard from './RotationLoopCard.svelte';

	const { Story } = defineMeta({
		title: 'Rotations/RotationLoopCard',
		component: RotationLoopCard,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: {
			loop: toiletLoop,
			editHref: '#',
			onsave: fn(async () => {}),
			onreset: fn(async () => {}),
		},
	});
</script>

<Story name="Eligible subset" />

<Story name="Whole household" args={{ loop: dishwasherLoop }} />

<Story
	name="Too few eligible"
	args={{
		loop: {
			...toiletLoop,
			members: toiletLoop.members.map((m) =>
				m.memberId === 'mia'
					? { ...m, eligible: false, exclusionReason: 'Away this week' }
					: m,
			),
		},
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
