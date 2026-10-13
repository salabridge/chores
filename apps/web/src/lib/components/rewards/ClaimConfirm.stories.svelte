<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ClaimConfirm.stories.svelte';
	import ClaimConfirm from './ClaimConfirm.svelte';

	const { Story } = defineMeta({
		title: 'Rewards/ClaimConfirm',
		component: ClaimConfirm,
		tags: ['autodocs'],
		args: {
			title: 'Pick Friday Movie',
			cost: 80,
			balance: 140,
			cancelHref: '#',
		},
	});
</script>

<Story name="Default" />

<Story name="Pending" args={{ pending: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
