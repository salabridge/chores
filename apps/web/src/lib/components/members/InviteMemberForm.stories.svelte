<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './InviteMemberForm.stories.svelte';
	import InviteMemberForm from './InviteMemberForm.svelte';

	// The members remote form is mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Members/InviteMemberForm',
		component: InviteMemberForm,
		tags: ['autodocs'],
		args: { canInviteParent: true, currentYear: 2026, oninvited: fn() },
	});
</script>

<Story name="Owner">
	{#snippet template(args)}
		<div class="max-w-[360px]"><InviteMemberForm {...args} /></div>
	{/snippet}
</Story>

<Story name="Parent (kids only)" args={{ canInviteParent: false }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><InviteMemberForm {...args} /></div>
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
