<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import WorkspaceHeader from './WorkspaceHeader.svelte';

	const { Story } = defineMeta({
		title: 'Shell/WorkspaceHeader',
		component: WorkspaceHeader,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: {
			title: 'Household Overview',
			subtitle:
				'Start here to manage chores, balance workload, and keep rotations moving.',
		},
	});
</script>

{#snippet actions()}
	<SecondaryButton href="#rotations">Manage Loops</SecondaryButton>
	<PrimaryButton
		href="#new"
		class="h-auto w-auto rounded-[10px] px-16 py-8 text-[14px]"
	>
		New Chore Loop
	</PrimaryButton>
{/snippet}

<Story name="Title only" args={{ subtitle: undefined }} />

<Story name="With subtitle" />

<Story name="With actions" args={{ actions }} />
