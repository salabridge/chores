<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { members } from './fixtures.ts';
	import * as thisFile from './MemberList.stories.svelte';
	import MemberList from './MemberList.svelte';

	const { Story } = defineMeta({
		title: 'Members/MemberList',
		component: MemberList,
		tags: ['autodocs'],
		args: { members },
	});
</script>

<Story name="Mixed household">
	{#snippet template(args)}
		<div class="max-w-[480px]"><MemberList {...args} /></div>
	{/snippet}
</Story>

<Story name="Owner only" args={{ members: members.slice(0, 1) }}>
	{#snippet template(args)}
		<div class="max-w-[480px]"><MemberList {...args} /></div>
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
