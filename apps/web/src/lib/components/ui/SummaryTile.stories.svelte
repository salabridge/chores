<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import * as thisFile from './SummaryTile.stories.svelte';
	import SummaryTile from './SummaryTile.svelte';

	const { Story } = defineMeta({
		title: 'UI/SummaryTile',
		component: SummaryTile,
		tags: ['autodocs'],
		argTypes: {
			tone: { control: 'inline-radio', options: ['orange', 'blue'] },
			size: { control: 'inline-radio', options: ['default', 'large'] },
		},
		args: {
			label: 'Personal',
			value: '2 chores',
			caption: '1 due today',
			tone: 'orange',
		},
	});
</script>

<Story name="Personal" />

<Story
	name="Shared"
	args={{
		label: 'Shared',
		value: '4 chores',
		caption: 'Your turn on 1',
		tone: 'blue',
	}}
/>

<Story
	name="Large"
	args={{ size: 'large', value: '2 chores', caption: '25 pts total' }}
/>

<Story name="Side by side" asChild>
	<div class="grid grid-cols-2 gap-12">
		<SummaryTile label="Personal" value="2 chores" caption="1 due today" />
		<SummaryTile
			label="Shared"
			value="4 chores"
			caption="Your turn on 1"
			tone="blue"
		/>
	</div>
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
