<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import {
		CHORE_FORM_ID,
		type ChoreDraft,
		toUpdateInput,
	} from '#lib/chore-creator.js';
	import { updateChore } from '#lib/chores.remote.js';
	import ChoreSetupForm from '#lib/components/chores/ChoreSetupForm.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Loaded once: reloading the page is how a parent picks up someone else's changes.
	// svelte-ignore state_referenced_locally
	let draft = $state<ChoreDraft>(data.draft);

	async function onsubmit(valid: ChoreDraft) {
		try {
			await updateChore(toUpdateInput(valid, data.choreId, data.updatedAt));
		} catch (e) {
			throw new Error(
				isHttpError(e) && e.body.message
					? e.body.message
					: 'Could not save this chore. Try again.',
			);
		}
		await invalidateAll();
		await goto('/overview');
	}
</script>

<svelte:head><title>Edit Chore · ChoreLoop</title></svelte:head>

<WorkspaceHeader
	title="Edit Chore"
	subtitle="Change what this chore is. Points already earned and completions already recorded stay as they are."
>
	{#snippet actions()}
		<PrimaryButton type="submit" form={CHORE_FORM_ID}>Save Changes</PrimaryButton>
	{/snippet}
</WorkspaceHeader>

<ChoreSetupForm
	bind:draft
	mode="edit"
	frequencyLocked={data.frequencyLocked}
	members={data.members}
	{onsubmit}
	cancelHref="/overview"
/>
