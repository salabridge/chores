<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import Badge from './Badge.svelte';
	import * as thisFile from './StatCard.stories.svelte';
	import StatCard from './StatCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/StatCard',
		component: StatCard,
		tags: ['autodocs'],
		args: {
			label: 'This week',
			value: '12 Chores',
			caption: '3 more than last week',
		},
	});
</script>

{#snippet badge()}
	<Badge tone="this-week">12 active</Badge>
{/snippet}

<Story name="Default" />

<Story name="With badge" args={{ badge }} />

<Story name="Value only" args={{ caption: undefined }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
