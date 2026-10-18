<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { inviteNow, invites } from './fixtures.ts';
	import * as thisFile from './PendingInvites.stories.svelte';
	import PendingInvites from './PendingInvites.svelte';

	// The members remote forms are mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Members/PendingInvites',
		component: PendingInvites,
		tags: ['autodocs'],
		args: { invites, actorRole: 'owner', now: inviteNow, onchanged: fn() },
		argTypes: {
			actorRole: { control: 'inline-radio', options: ['owner', 'parent'] },
		},
	});
</script>

<Story name="As owner">
	{#snippet template(args)}
		<div class="max-w-[560px]"><PendingInvites {...args} /></div>
	{/snippet}
</Story>

<Story name="As parent" args={{ actorRole: 'parent' }}>
	{#snippet template(args)}
		<div class="max-w-[560px]"><PendingInvites {...args} /></div>
	{/snippet}
</Story>

<Story name="Empty" args={{ invites: [] }}>
	{#snippet template(args)}
		<div class="max-w-[560px]"><PendingInvites {...args} /></div>
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
