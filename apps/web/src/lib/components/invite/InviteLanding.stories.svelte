<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { links, openKidInvite, openParentInvite, token } from './fixtures.ts';
	import * as thisFile from './InviteLanding.stories.svelte';
	import InviteLanding from './InviteLanding.svelte';

	// The accept form is mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Invite/InviteLanding',
		component: InviteLanding,
		tags: ['autodocs'],
		args: {
			invite: openKidInvite,
			token,
			signedInAs: null,
			problem: null,
			...links,
		},
	});
</script>

<Story name="Signed out">
	{#snippet template(args)}
		<div class="max-w-[360px]"><InviteLanding {...args} /></div>
	{/snippet}
</Story>

<Story name="Ready to join" args={{ invite: openParentInvite, signedInAs: 'sam@example.com' }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><InviteLanding {...args} /></div>
	{/snippet}
</Story>

<Story name="Wrong account" args={{ signedInAs: 'jim@example.com', problem: 'wrong-email' }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><InviteLanding {...args} /></div>
	{/snippet}
</Story>

<Story name="Expired" args={{ invite: { status: 'expired' } }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><InviteLanding {...args} /></div>
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
