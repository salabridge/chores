<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import {
		archiveChore,
		deleteChore,
		restoreChore,
	} from '#lib/chore-archive.remote.js';
	import {
		type ChoresGrouping,
		GROUPING_COOKIE,
	} from '#lib/chores-list.js';
	import ChoresList from '#lib/components/chores/ChoresList.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let grouping = $state<ChoresGrouping>(data.grouping);
	let showArchived = $state(false);
	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);

	// The choice is per device and not data, so it's a plain cookie the load
	// reads on the next request; failing to write it only loses the memory.
	$effect(() => {
		try {
			// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API isn't available in every browser
			document.cookie = `${GROUPING_COOKIE}=${grouping}; path=/; max-age=31536000; samesite=lax`;
		} catch {
			// Cookies blocked: the grouping just won't be remembered.
		}
	});

	// Remote errors carry the server's message (e.g. the 409 "archive it
	// instead"); anything else gets a generic one.
	async function run(
		choreId: string,
		action: (input: { choreId: string }) => Promise<unknown>,
		fallback: string,
	) {
		busyId = choreId;
		error = null;
		try {
			await action({ choreId });
			await invalidateAll();
		} catch (e) {
			error = isHttpError(e) && e.body.message ? e.body.message : fallback;
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head><title>Chores · ChoreLoop</title></svelte:head>

<WorkspaceHeader
	title="Chores"
	subtitle="Every chore in the household, by rotation or by person. Edit, duplicate or archive them here."
>
	{#snippet actions()}
		<SecondaryButton href="/rotations">Rotation Builder</SecondaryButton>
		<PrimaryButton href="/chores/new">Create & Assign</PrimaryButton>
	{/snippet}
</WorkspaceHeader>

<ChoresList
	chores={data.chores}
	members={data.members}
	bind:grouping
	bind:showArchived
	{busyId}
	{error}
	onarchive={(id) => run(id, archiveChore, 'Could not archive this chore. Try again.')}
	onrestore={(id) => run(id, restoreChore, 'Could not restore this chore. Try again.')}
	ondelete={(id) => run(id, deleteChore, 'Could not delete this chore. Try again.')}
/>
