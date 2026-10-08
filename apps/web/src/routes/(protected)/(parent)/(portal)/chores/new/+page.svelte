<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import {
		CHORE_FORM_ID,
		type ChoreDraft,
		emptyDraft,
		exampleDraft,
		toCreateInput,
	} from '#lib/chore-creator.js';
	import { createChore } from '#lib/chores.remote.js';
	import ChoreEligibilityPanel from '#lib/components/chores/ChoreEligibilityPanel.svelte';
	import ChoreSetupForm from '#lib/components/chores/ChoreSetupForm.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	// `?preset=household-rotation` comes from "New Rotation Loop" on the Loops Builder.
	let draft = $state<ChoreDraft>(
		emptyDraft(
			page.url.searchParams.get('preset') === 'household-rotation'
				? 'rotation'
				: 'personal',
		),
	);
	// Becomes true once a household rotation passes the setup form; SB-49's panel takes over from there.
	let eligibilityStep = $state(false);

	const isRotation = $derived(draft.kind === 'rotation');

	// Prefills the form with a finished rotation chore so parents can see what one looks like.
	function reviewExample() {
		draft = exampleDraft();
		eligibilityStep = false;
	}

	async function onsubmit(valid: ChoreDraft) {
		if (valid.kind === 'rotation') {
			// Rotations are saved from the Eligibility step (SB-49).
			eligibilityStep = true;
			return;
		}
		try {
			await createChore(toCreateInput(valid));
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

<svelte:head><title>Create & Assign · ChoreLoop</title></svelte:head>

<WorkspaceHeader
	title="Chore Creator"
	subtitle="Define the chore, decide if it belongs to one person or a household rotation, add stages if needed, then move into eligibility setup."
>
	{#snippet actions()}
		<SecondaryButton onclick={reviewExample}>
			Review Example
		</SecondaryButton>
		<PrimaryButton type="submit" form={CHORE_FORM_ID}>
			{isRotation ? 'Next: Eligibility Setup' : 'Create Chore'}
		</PrimaryButton>
	{/snippet}
</WorkspaceHeader>

<div class="grid items-start gap-32 xl:grid-cols-[minmax(0,1fr)_420px]">
	<ChoreSetupForm bind:draft members={data.members} {onsubmit} cancelHref="/overview" />
	<!-- SB-49 plugs in here: replace the body of ChoreEligibilityPanel. -->
	<aside class="min-w-0" aria-label="Eligibility Setup">
		<ChoreEligibilityPanel {draft} members={data.members} active={eligibilityStep} />
	</aside>
</div>
