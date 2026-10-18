<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './AppHeader.stories.svelte';
	import AppHeader from './AppHeader.svelte';

	const { Story } = defineMeta({
		title: 'Shell/AppHeader',
		component: AppHeader,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		argTypes: {
			pathname: {
				control: 'select',
				options: ['/today', '/rewards', '/streak', '/chores/1'],
			},
		},
		args: { pathname: '/today', member: { name: 'Leo', points: 140, tone: 'green' } },
	});
</script>

<Story name="Today" />

<Story name="Rewards" args={{ pathname: '/rewards' }} />

<Story name="Streak" args={{ pathname: '/streak' }} />

<Story name="No active tab" args={{ pathname: '/chores/1' }} />

<Story name="No household" args={{ member: null }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
