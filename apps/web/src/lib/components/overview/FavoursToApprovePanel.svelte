<script lang="ts">
	import {
		type FavourActions,
		type FavourItem,
		PANEL_ESCALATED_LABEL,
		PARENT_APPROVE_LABEL,
		PARENT_DECLINE_LABEL,
		panelDetail,
		panelLine,
	} from '#lib/favour-approval.js';
	import { runFavourAction } from '#lib/favour-run.js';
	import Badge from '../ui/Badge.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	/**
	 * "Favours to approve" on the parent Overview (SB-80). Every pending
	 * favour, the ones a kid asked a parent about first. A parent can decide
	 * any of them, not only the escalated ones; a parent's call is final.
	 */
	interface Props {
		favours: FavourItem[];
		actions: Pick<FavourActions, 'approve' | 'decline'>;
		/** Fixed in stories so "5 min ago" doesn't change between builds. */
		now?: Date;
	}

	let { favours, actions, now }: Props = $props();

	let busyKey = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function decide(item: FavourItem, kind: 'approve' | 'decline') {
		busyKey = `${item.completionId}:${kind}`;
		error = null;
		error = await runFavourAction(() => actions[kind](item.completionId));
		busyKey = null;
	}
</script>

{#if favours.length > 0}
	<SurfaceCard
		title="Favours to approve"
		subtitle="A sibling says they did a chore for someone else. Points are held until it's approved."
		data-testid="favours-panel"
	>
		{#snippet badge()}
			<Badge tone="required">{favours.length} waiting</Badge>
		{/snippet}
		{#if error}
			<p role="alert" class="text-[13px] text-text-orange">{error}</p>
		{/if}
		<ul class="flex flex-col">
			{#each favours as item (item.completionId)}
				<li
					class="flex flex-col gap-8 border-b border-border-subtle py-12 first:pt-0 last:border-b-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between lg:gap-16"
					data-escalated={item.escalatedAt ? 'true' : undefined}
				>
					<div class="flex min-w-0 flex-col gap-4">
						<p class="font-display text-[14px] font-semibold text-text-primary">
							{panelLine(item)}
							{#if item.escalatedAt}
								<span class="ml-6 rounded-[6px] bg-surface-accent-amber-subtle px-6 py-2 text-[11px] text-text-amber">
									{PANEL_ESCALATED_LABEL}
								</span>
							{/if}
						</p>
						<p class="text-[12px] text-text-secondary">{panelDetail(item, now)}</p>
					</div>
					<div class="flex shrink-0 items-center gap-8">
						<SecondaryButton
							variant="tinted"
							tone="green"
							aria-label="{PARENT_APPROVE_LABEL} {item.title}"
							pending={busyKey === `${item.completionId}:approve`}
							disabled={busyKey !== null}
							onclick={() => decide(item, 'approve')}
						>
							{PARENT_APPROVE_LABEL}
						</SecondaryButton>
						<SecondaryButton
							variant="tinted"
							tone="neutral"
							aria-label="{PARENT_DECLINE_LABEL} {item.title}"
							pending={busyKey === `${item.completionId}:decline`}
							disabled={busyKey !== null}
							onclick={() => decide(item, 'decline')}
						>
							{PARENT_DECLINE_LABEL}
						</SecondaryButton>
					</div>
				</li>
			{/each}
		</ul>
	</SurfaceCard>
{/if}
