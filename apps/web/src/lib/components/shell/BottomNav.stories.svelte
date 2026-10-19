<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './BottomNav.stories.svelte';
	import BottomNav from './BottomNav.svelte';

	const { Story } = defineMeta({
		title: 'Shell/BottomNav',
		component: BottomNav,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		argTypes: {
			pathname: {
				control: 'select',
				options: ['/today', '/rewards', '/streak', '/settings'],
			},
		},
		args: { pathname: '/today' },
	});
</script>

<Story name="Today" />

<Story name="Rewards" args={{ pathname: '/rewards' }} />

<Story name="Nested route" args={{ pathname: '/streak/history' }} />

<Story name="No active tab" args={{ pathname: '/settings' }} />

<Story name="Parent" args={{ parent: true }} />

<Story name="Parent on Account" args={{ pathname: '/account', parent: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
