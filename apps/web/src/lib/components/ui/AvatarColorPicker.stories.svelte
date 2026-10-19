<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './AvatarColorPicker.stories.svelte';
	import AvatarColorPicker from './AvatarColorPicker.svelte';

	const { Story } = defineMeta({
		title: 'UI/AvatarColorPicker',
		component: AvatarColorPicker,
		tags: ['autodocs'],
		args: { value: 'blue' },
	});
</script>

<Story name="Preset selected" />

<Story name="Custom colour selected" args={{ value: '#8b5cf6' }} />

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
