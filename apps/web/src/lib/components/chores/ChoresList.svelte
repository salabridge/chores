<script lang="ts">
	import {
		archivedChores,
		type ChoreListItem,
		type ChoreListMember,
		type ChoresGrouping,
		groupByIndividual,
		groupByRotation,
		loopTakers,
		parseGrouping,
		unassigned,
	} from '#lib/chores-list.js';
	import Callout from '../ui/Callout.svelte';
	import ChoiceChips from '../ui/ChoiceChips.svelte';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import ChoreListRow from './ChoreListRow.svelte';

	let {
		chores,
		members,
		grouping = $bindable('rotation'),
		showArchived = $bindable(false),
		busyId = null,
		error = null,
		createHref = '/chores/new',
		onarchive,
		onrestore,
		ondelete,
	}: {
		chores: ChoreListItem[];
		members: ChoreListMember[];
		/** How the active chores are grouped. Bindable. */
		grouping?: ChoresGrouping;
		/** Show archived chores instead of the active ones. Bindable. */
		showArchived?: boolean;
		/** The chore an archive, restore or delete is working on. */
		busyId?: string | null;
		/** The last failed action, worded for the parent. */
		error?: string | null;
		createHref?: string;
		onarchive?: (choreId: string) => void;
		onrestore?: (choreId: string) => void;
		ondelete?: (choreId: string) => void;
	} = $props();

	const groupingOptions = [
		{ value: 'rotation', label: 'Rotation' },
		{ value: 'individual', label: 'Individual' },
	];

	const byRotation = $derived(groupByRotation(chores));
	const byIndividual = $derived(groupByIndividual(chores, members));
	const orphans = $derived(unassigned(chores, members));
	const archived = $derived(archivedChores(chores));
	const activeCount = $derived(chores.filter((c) => !c.archived).length);

	const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '';
	const takerNames = (chore: ChoreListItem) =>
		loopTakers(chore).map(nameOf).filter(Boolean).join(', ');
</script>

{#snippet row(
	chore: ChoreListItem,
	extra: { inRotation?: boolean; theirTurn?: boolean; showAssignee?: boolean } = {},
)}
	<ChoreListRow
		{chore}
		{members}
		{...extra}
		busy={busyId === chore.id}
		{onarchive}
		{onrestore}
		{ondelete}
	/>
{/snippet}

<div class="flex flex-col gap-24">
	<div class="flex flex-wrap items-center justify-between gap-16">
		<div class="flex flex-wrap items-center gap-12">
			<span class="text-[13px] font-semibold text-text-secondary">Group by</span>
			<ChoiceChips
				label="Group by"
				options={groupingOptions}
				bind:value={() => grouping, (v) => (grouping = parseGrouping(v))}
				disabled={showArchived}
			/>
		</div>
		<div class="flex items-center gap-8 text-[13px] font-semibold text-text-secondary">
			<Toggle bind:checked={showArchived} aria-label="Show archived chores" />
			Archived
		</div>
	</div>

	{#if error}
		<Callout tone="warning" role="alert">{error}</Callout>
	{/if}

	{#if showArchived}
		<SurfaceCard
			title="Archived chores"
			subtitle="Hidden from everyone. Restore one to bring it back from the next period."
			data-testid="archived-section"
		>
			{#if archived.length === 0}
				<p class="text-[14px] text-text-secondary">No archived chores.</p>
			{:else}
				<ul class="flex flex-col gap-12">
					{#each archived as chore (chore.id)}
						{@render row(chore)}
					{/each}
				</ul>
			{/if}
		</SurfaceCard>
	{:else if activeCount === 0}
		<Callout tone="info" title="No chores yet" data-testid="empty-state">
			<div class="flex flex-col items-start gap-12">
				<p>Create a chore and decide who does it, and it will be listed here.</p>
				<PrimaryButton href={createHref}>Create & Assign</PrimaryButton>
			</div>
		</Callout>
	{:else if grouping === 'rotation'}
		{#each byRotation.rotations as chore (chore.id)}
			<SurfaceCard
				title={chore.title}
				subtitle={takerNames(chore) ? `Rotates between ${takerNames(chore)}` : 'Rotation'}
				data-testid="rotation-section"
			>
				<ul class="flex flex-col gap-12">
					{@render row(chore)}
				</ul>
			</SurfaceCard>
		{/each}
		{#if byRotation.personal.length > 0}
			<SurfaceCard title="Personal chores" data-testid="personal-section">
				<ul class="flex flex-col gap-12">
					{#each byRotation.personal as chore (chore.id)}
						{@render row(chore)}
					{/each}
				</ul>
			</SurfaceCard>
		{/if}
	{:else}
		{#each byIndividual as group (group.member.id)}
			<SurfaceCard title={group.member.name} data-testid="member-section">
				{#if group.entries.length === 0}
					<p class="text-[14px] text-text-secondary">No chores yet.</p>
				{:else}
					<ul class="flex flex-col gap-12">
						{#each group.entries as entry (entry.chore.id)}
							{@render row(entry.chore, {
								inRotation: entry.inRotation,
								theirTurn: entry.theirTurn,
								showAssignee: false,
							})}
						{/each}
					</ul>
				{/if}
			</SurfaceCard>
		{/each}
		{#if orphans.length > 0}
			<SurfaceCard
				title="Unassigned"
				subtitle="Nobody is doing these right now."
				data-testid="unassigned-section"
			>
				<ul class="flex flex-col gap-12">
					{#each orphans as chore (chore.id)}
						{@render row(chore)}
					{/each}
				</ul>
			</SurfaceCard>
		{/if}
	{/if}
</div>
