<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './LandingRouteForm.stories.svelte';
	import LandingRouteForm from './LandingRouteForm.svelte';

	// `saveLanding` is mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Profiles/LandingRouteForm',
		component: LandingRouteForm,
		tags: ['autodocs'],
		argTypes: {
			landingRoute: { control: 'inline-radio', options: ['today', 'overview'] },
		},
		args: { landingRoute: 'today' },
	});
</script>

<Story name="Today">
	{#snippet template(args)}
		<div class="max-w-[360px]"><LandingRouteForm {...args} /></div>
	{/snippet}
</Story>

<Story name="Parent dashboard" args={{ landingRoute: 'overview' }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><LandingRouteForm {...args} /></div>
	{/snippet}
</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
