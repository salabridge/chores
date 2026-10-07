<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import LoopExamples from '#lib/components/rotations/LoopExamples.svelte';
	import RotationGuide from '#lib/components/rotations/RotationGuide.svelte';
	import RotationLoopCard from '#lib/components/rotations/RotationLoopCard.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { loopExample, type SaveLoopInput } from '#lib/rotation-loops.js';
	import { resetLoop, saveLoop } from '#lib/rotations.remote.js';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Remote errors carry the server's message; anything else gets a generic one.
	const messageOf = (e: unknown, fallback: string) =>
		isHttpError(e) && e.body.message ? e.body.message : fallback;

	async function onsave(input: SaveLoopInput) {
		try {
			await saveLoop(input);
		} catch (e) {
			throw new Error(messageOf(e, 'Could not save this loop. Try again.'));
		}
		await invalidateAll();
	}

	async function onreset(choreId: string) {
		try {
			await resetLoop({ choreId });
		} catch (e) {
			throw new Error(messageOf(e, 'Could not reset this loop. Try again.'));
		}
		await invalidateAll();
	}
</script>

<svelte:head><title>Rotation Loops Builder · ChoreLoop</title></svelte:head>

<WorkspaceHeader
	title="Rotation Loops Builder"
	subtitle="Choose whether a shared chore rotates across the whole household or an eligible subset, preview the assignment order, and understand when the loop advances."
>
	{#snippet actions()}
		<SecondaryButton href="/overview">View Overview</SecondaryButton>
		<PrimaryButton href="/chores/new?preset=household-rotation">New Rotation Loop</PrimaryButton>
	{/snippet}
</WorkspaceHeader>

<div class="grid items-start gap-24 xl:grid-cols-[minmax(0,1fr)_340px]">
	<div class="flex min-w-0 flex-col gap-24">
		{#each data.loops as loop (loop.choreId)}
			<RotationLoopCard
				{loop}
				editHref="/chores/new?edit={loop.choreId}"
				{onsave}
				{onreset}
			/>
		{:else}
			<Callout tone="info" title="No rotation loops yet">
				Create a shared chore that rotates between members and it will show up here, where you
				can choose who takes part and in what order.
			</Callout>
		{/each}
	</div>
	<aside class="flex min-w-0 flex-col gap-24" aria-label="About rotations">
		<RotationGuide />
		<LoopExamples examples={data.loops.map(loopExample)} />
	</aside>
</div>
