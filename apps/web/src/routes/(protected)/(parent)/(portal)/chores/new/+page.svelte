<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import {
		CHORE_FORM_ID,
		type ChoreDraft,
		emptyDraft,
		exampleDraft,
		toCreateInput,
	} from '#lib/chore-creator.js';
	import { archiveOriginalDefault } from '#lib/chore-duplicate.js';
	import type { CreateRotationChoreInput } from '#lib/chore-eligibility.js';
	import { createChore, createRotation } from '#lib/chores.remote.js';
	import ArchiveOriginalOption from '#lib/components/chores/ArchiveOriginalOption.svelte';
	import ChoreEligibilityPanel from '#lib/components/chores/ChoreEligibilityPanel.svelte';
	import ChoreSetupForm from '#lib/components/chores/ChoreSetupForm.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	// `?from=` is "Duplicate as…": the load hands over the copied chore as a draft.
	const duplicate = $derived(data.duplicate);
	// `?preset=household-rotation` comes from "New Rotation Loop" on the Loops Builder.
	// svelte-ignore state_referenced_locally
	let draft = $state<ChoreDraft>(
		data.duplicate?.draft ??
			emptyDraft(
				page.url.searchParams.get('preset') === 'household-rotation'
					? 'rotation'
					: 'personal',
			),
	);
	// On when the copy is of the other kind, off for a plain duplicate.
	// svelte-ignore state_referenced_locally
	let archiveOriginal = $state(
		archiveOriginalDefault(data.duplicate?.kindChanges ?? false),
	);
	// Sent with the create, which archives the original in the same transaction.
	const archiveSourceId = $derived(
		duplicate && archiveOriginal ? duplicate.sourceId : null,
	);
	// Becomes true once a household rotation passes the setup form; the Eligibility panel then saves it.
	let eligibilityStep = $state(false);

	const isRotation = $derived(draft.kind === 'rotation');

	// Prefills the form with a finished rotation chore so parents can see what one looks like.
	function reviewExample() {
		draft = exampleDraft();
		eligibilityStep = false;
	}

	const failure = (e: unknown) =>
		new Error(
			isHttpError(e) && e.body.message
				? e.body.message
				: 'Could not save this chore. Try again.',
		);

	async function saveRotation(input: CreateRotationChoreInput) {
		try {
			await createRotation({ ...input, archiveSourceId });
		} catch (e) {
			throw failure(e);
		}
		await invalidateAll();
		await goto('/overview');
	}

	async function onsubmit(valid: ChoreDraft) {
		if (valid.kind === 'rotation') {
			// Rotations are saved from the Eligibility Setup panel.
			eligibilityStep = true;
			return;
		}
		try {
			await createChore({ ...toCreateInput(valid), archiveSourceId });
		} catch (e) {
			throw failure(e);
		}
		await invalidateAll();
		await goto('/overview');
	}
</script>

<svelte:head><title>Create & Assign · ChoreLoop</title></svelte:head>

<WorkspaceHeader
	title="Chore Creator"
	subtitle="Define the chore, decide if it belongs to one person or a household rotation, add stages if needed, then move into eligibility setup."
>
	{#snippet actions()}
		<SecondaryButton onclick={reviewExample}>
			Review Example
		</SecondaryButton>
		<PrimaryButton size="sm" type="submit" form={CHORE_FORM_ID}>
			{isRotation ? 'Next: Eligibility Setup' : 'Create Chore'}
		</PrimaryButton>
	{/snippet}
</WorkspaceHeader>

{#if duplicate}
	<div class="mb-16">
		<ArchiveOriginalOption
			sourceTitle={duplicate.sourceTitle}
			sourceKind={duplicate.sourceKind}
			kindChanges={duplicate.kindChanges}
			bind:checked={archiveOriginal}
		/>
	</div>
{/if}

<div class="grid items-start gap-32 xl:grid-cols-[minmax(0,1fr)_420px]">
	<ChoreSetupForm bind:draft members={data.members} {onsubmit} cancelHref="/overview" />
	<aside class="min-w-0" aria-label="Eligibility Setup">
		<ChoreEligibilityPanel {draft} members={data.members} active={eligibilityStep} onsave={saveRotation} />
	</aside>
</div>
