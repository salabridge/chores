<script lang="ts">
	import ChoreStatusTable from '#lib/components/overview/ChoreStatusTable.svelte';
	import ExceptionsNotesPanel from '#lib/components/overview/ExceptionsNotesPanel.svelte';
	import ManageChoresPanel from '#lib/components/overview/ManageChoresPanel.svelte';
	import MemberWorkloadPanel from '#lib/components/overview/MemberWorkloadPanel.svelte';
	import OverviewStats from '#lib/components/overview/OverviewStats.svelte';
	import UpcomingRotationsPanel from '#lib/components/overview/UpcomingRotationsPanel.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';

	let { data } = $props();

	// Skip and Remind need SB-29 (parent chore actions), and Reopen needs a
	// parent-authenticated call to app.reopen_chore_completion (SB-26). None
	// has a web endpoint yet, so the table renders them disabled. When one
	// lands, pass a handler through `actions` and call `invalidateAll()` after
	// it so the table refreshes, e.g.
	//   skip: async (row) => { await skipChore({ ... }); await invalidateAll(); }
</script>

<svelte:head><title>Household Overview · ChoreLoop</title></svelte:head>

<WorkspaceHeader
	title="Household Overview"
	subtitle="Start here to manage chores, balance workload, and keep rotations moving."
>
	{#snippet actions()}
		<SecondaryButton href="/rotations">Manage Loops</SecondaryButton>
		<PrimaryButton href="/chores/new?preset=household-rotation">+ New Chore Loop</PrimaryButton>
	{/snippet}
</WorkspaceHeader>

<OverviewStats stats={data.overview.stats} />

<div class="grid items-start gap-16 xl:grid-cols-[minmax(0,1fr)_340px]">
	<div class="flex min-w-0 flex-col gap-16" data-slot="overview-main">
		<ChoreStatusTable rows={data.overview.rows} unavailableHint="Coming soon" />
		<UpcomingRotationsPanel rotations={data.overview.rotations} />
	</div>
	<aside
		class="flex min-w-0 flex-col gap-16"
		aria-label="Household panels"
		data-slot="overview-aside"
	>
		<MemberWorkloadPanel workload={data.overview.workload} />
		<ExceptionsNotesPanel notes={data.overview.notes} />
		<ManageChoresPanel />
	</aside>
</div>
