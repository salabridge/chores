<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import { completionHref } from '#lib/chore-completion.js';
	import { duplicateHref } from '#lib/chore-duplicate.js';
	import PersonalChoreDetail from '#lib/components/chores/PersonalChoreDetail.svelte';
	import RotationChoreDetail from '#lib/components/rotations/RotationChoreDetail.svelte';
	import PageHeader from '#lib/components/shell/PageHeader.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { completeStage, completeTurn } from '#lib/rotation-detail.remote.js';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	const id = $derived(page.params.id ?? '');

	// Remote errors carry the server's message; anything else gets a generic one.
	const messageOf = (e: unknown, fallback: string) =>
		isHttpError(e) && e.body.message ? e.body.message : fallback;

	async function oncomplete() {
		let result: Awaited<ReturnType<typeof completeTurn>>;
		try {
			result = await completeTurn({ choreId: id });
		} catch (e) {
			// The turn may have moved on (another device); show what's true now.
			await invalidateAll();
			throw new Error(messageOf(e, 'Could not complete this turn. Try again.'));
		}
		// A completion id means the points are in the ledger; the done screen reads them.
		await (result.completionId
			? goto(completionHref(id, result.completionId))
			: invalidateAll());
	}

	async function oncompletestage(stageId: string) {
		let result: Awaited<ReturnType<typeof completeStage>>;
		try {
			result = await completeStage({ choreId: id, stageId });
		} catch (e) {
			await invalidateAll();
			throw new Error(messageOf(e, 'Could not save this stage. Try again.'));
		}
		if (result.choreCompleted && result.completionId) {
			await goto(completionHref(id, result.completionId));
		} else await invalidateAll();
	}
</script>

{#snippet editAction()}
	<SecondaryButton href="/chores/{id}/edit">Edit</SecondaryButton>
{/snippet}

<svelte:head><title>{(data.rotation ?? data.personal)?.title ?? 'Chore'} · ChoreLoop</title></svelte:head>

{#if data.rotation}
	<PageHeader label="Rotation Loop" actions={data.canEdit ? editAction : undefined} />
	<RotationChoreDetail detail={data.rotation} {oncomplete} {oncompletestage} />
{:else if data.personal}
	<PageHeader label="Personal Chore" actions={data.canEdit ? editAction : undefined} />
	<PersonalChoreDetail detail={data.personal} onstagedone={() => invalidateAll()} />
{/if}

{#if data.canEdit}
	<nav aria-label="Duplicate this chore" class="flex flex-wrap items-center gap-12 px-24 pb-24 text-[14px] font-semibold text-text-orange">
		<span class="text-text-secondary">Duplicate as…</span>
		<a href={duplicateHref(id, data.rotation ? 'personal' : 'rotation')}>
			{data.rotation ? 'Personal chore' : 'Rotation'}
		</a>
		<a href={duplicateHref(id)}>Same kind</a>
	</nav>
{/if}
