<script lang="ts">
	import { remindChoreAction, skipChoreAction } from '#lib/chore-actions.remote.js';
	import ChoreStatusTable, {
		type ChoreRowActions,
	} from '#lib/components/overview/ChoreStatusTable.svelte';
	import ExceptionsNotesPanel from '#lib/components/overview/ExceptionsNotesPanel.svelte';
	import ManageChoresPanel from '#lib/components/overview/ManageChoresPanel.svelte';
	import MemberWorkloadPanel from '#lib/components/overview/MemberWorkloadPanel.svelte';
	import OverviewStats from '#lib/components/overview/OverviewStats.svelte';
	import UpcomingRotationsPanel from '#lib/components/overview/UpcomingRotationsPanel.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Reopen needs a parent-authenticated call to app.reopen_chore_completion
	// (SB-26) and has no web endpoint yet, so the table renders it disabled.
	// Pass a handler through `actions` when it lands. Skip refreshes the page
	// data so the table shows the new turn-holder. Remind changes nothing on
	// this page, so it confirms with a notice instead of reloading.
	let notice = $state<string | null>(null);
	const actions: ChoreRowActions = {
		skip: async (row) => {
			notice = null;
			await skipChoreAction({ choreId: row.choreId });
			await invalidateAll();
		},
		remind: async (row) => {
			notice = null;
			const { assigneeName, sent } = await remindChoreAction({
				choreId: row.choreId,
			});
			notice = sent
				? `Reminder sent to ${assigneeName}.`
				: `${assigneeName} was just reminded.`;
		},
	};
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
		<ChoreStatusTable rows={data.overview.rows} {actions} unavailableHint="Coming soon" />
		<p role="status" class="text-[13px] text-text-secondary empty:hidden">{notice}</p>
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
