<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './InviteLinkNotice.stories.svelte';
	import InviteLinkNotice from './InviteLinkNotice.svelte';

	const { Story } = defineMeta({
		title: 'Members/InviteLinkNotice',
		component: InviteLinkNotice,
		tags: ['autodocs'],
		args: {
			email: 'sam@example.com',
			link: 'https://chores.example/invite/3q2-7wEXAMPLEtoken_abcdefghijklmnopqrstu',
		},
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="max-w-[360px]"><InviteLinkNotice {...args} /></div>
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
