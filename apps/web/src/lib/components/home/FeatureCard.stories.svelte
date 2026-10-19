<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import giftIcon from '#lib/assets/icons/gift.svg';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import * as thisFile from './FeatureCard.stories.svelte';
	import FeatureCard from './FeatureCard.svelte';

	const { Story } = defineMeta({
		title: 'Home/FeatureCard',
		component: FeatureCard,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: {
			icon: giftIcon,
			title: 'Points & rewards',
			description:
				'Earn points for completed chores and save up for rewards your family chooses.',
			example: 'Choose a movie · Pick a family outing',
		},
	});
</script>

<Story name="Default" />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={responsiveVisualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
