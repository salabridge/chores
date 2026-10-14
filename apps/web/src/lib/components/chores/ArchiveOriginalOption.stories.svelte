<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ArchiveOriginalOption.stories.svelte';
	import ArchiveOriginalOption from './ArchiveOriginalOption.svelte';

	const { Story } = defineMeta({
		title: 'Chores/ArchiveOriginalOption',
		component: ArchiveOriginalOption,
		tags: ['autodocs'],
		argTypes: {
			sourceKind: { control: 'inline-radio', options: ['personal', 'rotation'] },
		},
		args: {
			sourceTitle: 'Bathroom Rotation',
			sourceKind: 'rotation',
			kindChanges: true,
			checked: true,
			disabled: false,
		},
	});
</script>

<Story name="Kind changes" />

<Story
	name="Plain duplicate"
	args={{ sourceKind: 'personal', sourceTitle: 'Run Dishwasher', kindChanges: false, checked: false }}
/>

<Story name="Disabled" args={{ disabled: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
