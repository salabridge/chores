<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import * as thisFile from './PageHeader.stories.svelte';
	import PageHeader from './PageHeader.svelte';

	const { Story } = defineMeta({
		title: 'Shell/PageHeader',
		component: PageHeader,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { label: 'Personal Chore', backHref: '#today' },
	});
</script>

{#snippet editAction()}
	<SecondaryButton href="#edit">Edit</SecondaryButton>
{/snippet}

<Story name="Default" />

<Story name="Long label" args={{ label: 'Household Rotation Settings' }} />

<Story name="With edit action" args={{ actions: editAction }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
