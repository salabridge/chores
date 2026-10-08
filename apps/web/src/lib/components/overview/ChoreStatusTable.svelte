<script lang="ts" module>
	import type { ChoreStatusRow } from '#lib/overview.js';

	/** What a row action does; a missing handler renders its button disabled. */
	export interface ChoreRowActions {
		skip?: (row: ChoreStatusRow) => Promise<void>;
		remind?: (row: ChoreStatusRow) => Promise<void>;
		reopen?: (row: ChoreStatusRow) => Promise<void>;
	}
</script>

<script lang="ts">
	import { openCount, plural, rowActions } from '#lib/overview.js';
	import Badge from '../ui/Badge.svelte';
	import MemberAvatar from '../ui/MemberAvatar.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	interface Props {
		rows: ChoreStatusRow[];
		actions?: ChoreRowActions;
		/** Where "View Loop" goes. */
		loopHref?: string;
		/** Shown on disabled actions that have no backend yet. */
		unavailableHint?: string;
	}

	let {
		rows,
		actions = {},
		loopHref = '/rotations',
		unavailableHint = 'Not available yet',
	}: Props = $props();

	const open = $derived(openCount(rows));

	let pendingKey = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function run(
		handler: ((row: ChoreStatusRow) => Promise<void>) | undefined,
		row: ChoreStatusRow,
		kind: string,
	) {
		if (!handler) return;
		pendingKey = `${row.choreId}:${kind}`;
		error = null;
		try {
			await handler(row);
		} catch (e) {
			error =
				e instanceof Error && e.message
					? e.message
					: `Could not ${kind} ${row.title}. Try again.`;
		} finally {
			pendingKey = null;
		}
	}

	const isPending = (row: ChoreStatusRow, kind: string) =>
		pendingKey === `${row.choreId}:${kind}`;
</script>

{#snippet actionButton(
	row: ChoreStatusRow,
	kind: 'skip' | 'remind' | 'reopen',
	label: string,
	tone: 'orange' | 'neutral',
)}
	{@const handler = actions[kind]}
	<SecondaryButton
		variant="tinted"
		{tone}
		disabled={!handler}
		pending={isPending(row, kind)}
		title={handler ? undefined : unavailableHint}
		aria-label="{label} {row.title}"
		onclick={() => run(handler, row, kind)}
	>
		{label}
	</SecondaryButton>
{/snippet}

<SurfaceCard
	title="Chore Status"
	subtitle="What needs attention before the next rotation."
>
	{#snippet badge()}
		<Badge tone="required">{plural(open, 'open item')}</Badge>
	{/snippet}

	{#if rows.length === 0}
		<p class="text-[14px] text-text-secondary">No chores are due today.</p>
	{:else}
		{#if error}
			<p role="alert" class="text-[13px] text-text-orange">{error}</p>
		{/if}
		<table aria-label="Chore status" class="block w-full text-left lg:table">
			<thead class="hidden lg:table-header-group">
				<tr class="bg-background-base font-display text-[13px] font-bold text-text-secondary">
					<th scope="col" class="w-[32%] rounded-l-[8px] px-16 py-12 font-bold">CHORE / LOOP</th>
					<th scope="col" class="w-[18%] px-16 py-12 font-bold">ASSIGNEE</th>
					<th scope="col" class="w-[15%] px-16 py-12 font-bold">STATUS</th>
					<th scope="col" class="w-[10%] px-16 py-12 font-bold">POINTS</th>
					<th scope="col" class="rounded-r-[8px] px-16 py-12 text-right font-bold">ACTIONS</th>
				</tr>
			</thead>
			<tbody class="block lg:table-row-group">
				{#each rows as row (row.choreId)}
					{@const available = rowActions(row)}
					<tr
						data-status={row.status}
						class="flex flex-col gap-8 border-b border-border-subtle p-16 last:border-b-0 lg:table-row lg:p-0"
					>
						<td class="block min-w-0 lg:table-cell lg:px-16 lg:py-16 lg:align-middle">
							<span class="flex flex-col gap-4">
								<span class="font-display text-[14px] font-semibold text-text-primary">
									{row.title}
								</span>
								<span class="text-[12px] text-text-secondary">{row.context}</span>
							</span>
						</td>
						<td class="block lg:table-cell lg:px-16 lg:py-16 lg:align-middle">
							<span class="flex items-center gap-8 text-[14px] text-text-primary">
								{#if row.assignee}
									<MemberAvatar name={row.assignee.name} size="sm" />
									<span>{row.assignee.name}</span>
								{:else}
									<span class="text-text-secondary">Unassigned</span>
								{/if}
							</span>
						</td>
						<td class="block lg:table-cell lg:px-16 lg:py-16 lg:align-middle">
							<Badge tone={row.status} />
						</td>
						<td class="block text-[14px] text-text-primary lg:table-cell lg:px-16 lg:py-16 lg:align-middle">
							{row.points} pts
						</td>
						<td class="block lg:table-cell lg:px-16 lg:py-16 lg:align-middle">
							<span class="flex flex-wrap items-center gap-8 lg:justify-end">
								{#if available.skip}
									{@render actionButton(row, 'skip', 'Skip', 'neutral')}
								{/if}
								{#if available.remind}
									{@render actionButton(row, 'remind', 'Remind', 'orange')}
								{/if}
								{#if available.reopen}
									{@render actionButton(row, 'reopen', 'Reopen', 'neutral')}
								{/if}
								{#if available.viewLoop}
									<SecondaryButton variant="tinted" tone="blue" href={loopHref}>
										View Loop
									</SecondaryButton>
								{/if}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</SurfaceCard>
