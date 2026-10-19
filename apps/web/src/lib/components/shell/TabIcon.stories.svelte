<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './TabIcon.stories.svelte';
	import TabIcon from './TabIcon.svelte';

	const { Story } = defineMeta({
		title: 'Shell/TabIcon',
		component: TabIcon,
		tags: ['autodocs'],
		argTypes: {
			icon: { control: 'inline-radio', options: ['home', 'gift', 'flame', 'grid', 'user'] },
		},
		args: { icon: 'home' },
	});
</script>

<Story name="Home" />

<Story name="Gift" args={{ icon: 'gift' }} />

<Story name="Flame" args={{ icon: 'flame' }} />

<Story name="Grid" args={{ icon: 'grid' }} />

<Story name="User" args={{ icon: 'user' }} />

<Story name="Header size" args={{ icon: 'home', size: 20 }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
