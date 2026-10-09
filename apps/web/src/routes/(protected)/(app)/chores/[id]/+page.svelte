<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import RotationChoreDetail from '#lib/components/rotations/RotationChoreDetail.svelte';
	import PageHeader from '#lib/components/shell/PageHeader.svelte';
	import StickyActionBar from '#lib/components/shell/StickyActionBar.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import { completeStage, completeTurn } from '#lib/rotation-detail.remote.js';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	const id = $derived(page.params.id ?? '');

	// Remote errors carry the server's message; anything else gets a generic one.
	const messageOf = (e: unknown, fallback: string) =>
		isHttpError(e) && e.body.message ? e.body.message : fallback;

	async function oncomplete() {
		try {
			await completeTurn({ choreId: id });
		} catch (e) {
			// The turn may have moved on (another device); show what's true now.
			await invalidateAll();
			throw new Error(messageOf(e, 'Could not complete this turn. Try again.'));
		}
		await goto(`/chores/${id}/complete`);
	}

	async function oncompletestage(stageId: string) {
		let result: Awaited<ReturnType<typeof completeStage>>;
		try {
			result = await completeStage({ choreId: id, stageId });
		} catch (e) {
			await invalidateAll();
			throw new Error(messageOf(e, 'Could not save this stage. Try again.'));
		}
		if (result.choreCompleted) await goto(`/chores/${id}/complete`);
		else await invalidateAll();
	}
</script>

<svelte:head><title>{data.rotation?.title ?? 'Chore'} · ChoreLoop</title></svelte:head>

{#if data.rotation}
	<PageHeader label="Rotation Loop" />
	<RotationChoreDetail detail={data.rotation} {oncomplete} {oncompletestage} />
{:else}
	<PageHeader label="Personal Chore" />

	<div class="flex flex-1 flex-col gap-8 p-24">
		<p class="text-[14px] text-text-secondary">Chore {id} details coming soon.</p>
	</div>

	<StickyActionBar>
		{#snippet summary()}Reward after all 3 stages · 15 pts{/snippet}
		<PrimaryButton href="/chores/{id}/complete">Start</PrimaryButton>
	</StickyActionBar>
{/if}
