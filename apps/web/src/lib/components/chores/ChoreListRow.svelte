<script lang="ts">
	import {
		type ChoreListItem,
		type ChoreListMember,
		duplicateLinks,
		frequencyLabel,
		loopTakers,
		stageLabel,
	} from '#lib/chores-list.js';
	import Badge from '../ui/Badge.svelte';
	import PointsPill from '../ui/PointsPill.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';

	let {
		chore,
		members,
		inRotation = false,
		theirTurn = false,
		showAssignee = true,
		busy = false,
		onarchive,
		onrestore,
		ondelete,
	}: {
		chore: ChoreListItem;
		/** For turning member ids into names. */
		members: ChoreListMember[];
		/** Individual grouping: this person takes turns in the rotation. */
		inRotation?: boolean;
		/** Individual grouping: and it's their turn. */
		theirTurn?: boolean;
		/** Hidden where the section already names the person. */
		showAssignee?: boolean;
		/** An archive, restore or delete for this chore is in flight. */
		busy?: boolean;
		onarchive?: (choreId: string) => void;
		onrestore?: (choreId: string) => void;
		ondelete?: (choreId: string) => void;
	} = $props();

	const nameOf = (id: string | null) =>
		members.find((m) => m.id === id)?.name ?? null;

	const takers = $derived(
		loopTakers(chore).map((id) => ({
			id,
			name: nameOf(id) ?? 'Someone',
			current: id === chore.currentMemberId,
		})),
	);
	const assignee = $derived(nameOf(chore.assignedMemberId));

	// Deleting can't be undone, so it takes a second press.
	let confirming = $state(false);
</script>

<li
	data-testid="chore-row"
	class="flex flex-col gap-12 rounded-[12px] border border-border-subtle bg-background-base p-16 sm:flex-row sm:items-center sm:justify-between"
>
	<div class="flex min-w-0 flex-col gap-8">
		<div class="flex flex-wrap items-center gap-8">
			<h3 class="font-display text-[15px] font-semibold text-text-primary">
				{chore.title}
			</h3>
			{#if inRotation}<Badge tone="shared">In rotation</Badge>{/if}
			{#if theirTurn}<Badge tone="active-turn">Their turn</Badge>{/if}
		</div>
		<p class="flex flex-wrap items-center gap-x-8 gap-y-4 text-[13px] text-text-secondary">
			<span>{frequencyLabel[chore.frequency]}</span>
			<span aria-hidden="true">·</span>
			<PointsPill points={chore.points} />
			<span aria-hidden="true">·</span>
			<span>{stageLabel(chore.stageCount)}</span>
			{#if chore.type === 'rotation' && takers.length > 0}
				<span aria-hidden="true">·</span>
				<span data-testid="loop">
					Loop:
					{#each takers as taker, i (taker.id)}
						<span class={taker.current ? 'font-semibold text-text-primary' : ''}
							>{taker.name}{taker.current ? ' (turn)' : ''}</span
						>{i < takers.length - 1 ? ', ' : ''}
					{/each}
				</span>
			{:else if showAssignee && chore.type === 'personal'}
				<span aria-hidden="true">·</span>
				<span>{assignee ?? 'Unassigned'}</span>
			{/if}
		</p>
	</div>

	<div class="flex shrink-0 flex-wrap items-center gap-8">
		{#if chore.archived}
			<SecondaryButton
				variant="tinted"
				tone="green"
				disabled={busy}
				aria-label={`Restore ${chore.title}`}
				onclick={() => onrestore?.(chore.id)}>Restore</SecondaryButton
			>
			{#if !chore.completed}
				{#if confirming}
					<SecondaryButton
						variant="tinted"
						tone="amber"
						disabled={busy}
						aria-label={`Confirm delete ${chore.title}`}
						onclick={() => {
							confirming = false;
							ondelete?.(chore.id);
						}}>Delete for good</SecondaryButton
					>
					<SecondaryButton
						variant="tinted"
						tone="neutral"
						onclick={() => (confirming = false)}>Cancel</SecondaryButton
					>
				{:else}
					<SecondaryButton
						variant="tinted"
						tone="neutral"
						disabled={busy}
						aria-label={`Delete ${chore.title}`}
						onclick={() => (confirming = true)}>Delete</SecondaryButton
					>
				{/if}
			{/if}
		{:else}
			<SecondaryButton
				variant="tinted"
				tone="blue"
				href={`/chores/${chore.id}/edit`}
				aria-label={`Edit ${chore.title}`}>Edit</SecondaryButton
			>
			<details class="relative">
				<summary
					class="inline-flex cursor-pointer list-none items-center gap-4 rounded-[8px] bg-background-base px-12 py-6 font-display text-[12px] font-semibold text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange"
					aria-label={`Duplicate ${chore.title} as…`}>Duplicate as…</summary
				>
				<ul
					class="absolute right-0 z-10 mt-4 flex min-w-[200px] flex-col gap-4 rounded-[12px] border border-border-subtle bg-surface-default p-8 shadow-sm"
				>
					{#each duplicateLinks(chore) as link (link.href)}
						<li>
							<a
								href={link.href}
								class="block rounded-[8px] px-12 py-8 text-[13px] text-text-primary hover:bg-background-base focus-visible:outline-2 focus-visible:outline-border-orange"
								>{link.label}</a
							>
						</li>
					{/each}
				</ul>
			</details>
			<SecondaryButton
				variant="tinted"
				tone="amber"
				disabled={busy}
				aria-label={`Archive ${chore.title}`}
				onclick={() => onarchive?.(chore.id)}>Archive</SecondaryButton
			>
		{/if}
	</div>
</li>
