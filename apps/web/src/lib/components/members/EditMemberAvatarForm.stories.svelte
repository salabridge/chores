<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './EditMemberAvatarForm.stories.svelte';
	import EditMemberAvatarForm from './EditMemberAvatarForm.svelte';
	import { members } from './fixtures.ts';

	// The members remote forms are mocked in .storybook/mocks, so saving does nothing.
	const { Story } = defineMeta({
		title: 'Members/EditMemberAvatarForm',
		component: EditMemberAvatarForm,
		tags: ['autodocs'],
		args: { member: members[2], onsaved: fn(), oncancel: fn() },
	});
</script>

<Story name="Preset colour">
	{#snippet template(args)}
		<div class="max-w-[420px]"><EditMemberAvatarForm {...args} /></div>
	{/snippet}
</Story>

<Story
	name="Custom colour and initial"
	args={{ member: { ...members[2], avatarColor: '#8b5cf6', avatarInitial: 'MJ' } }}
>
	{#snippet template(args)}
		<div class="max-w-[420px]"><EditMemberAvatarForm {...args} /></div>
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
