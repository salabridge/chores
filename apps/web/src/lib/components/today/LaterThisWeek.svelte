<script lang="ts">
	import ChoreCard from '#lib/components/ui/ChoreCard.svelte';
	import type { TodayItem } from '#lib/today.js';

	/**
	 * Weekly chores due on a later day this week (SB-71), collapsed under one
	 * heading so they don't crowd what's due today. They can already be done,
	 * so each card links to its chore as usual.
	 */
	interface Props {
		items: TodayItem[];
		/** Expanded. Bindable; starts collapsed. */
		open?: boolean;
	}

	let { items, open = $bindable(false) }: Props = $props();
</script>

{#snippet calendar()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="size-full"
		aria-hidden="true"
	>
		<rect x="3" y="4" width="18" height="18" rx="2" />
		<path d="M16 2v4M8 2v4M3 10h18" />
	</svg>
{/snippet}

{#if items.length > 0}
	<details
		bind:open
		class="group block min-w-0 rounded-[16px] border border-border-subtle bg-surface-default"
		data-testid="later-this-week"
	>
		<summary
			class="flex cursor-pointer list-none items-center justify-between gap-12 rounded-[16px] p-16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange [&::-webkit-details-marker]:hidden"
		>
			<span class="flex min-w-0 flex-col gap-2">
				<span class="font-display text-[17px] font-semibold text-text-primary lg:text-[20px]">
					Later this week
				</span>
				<span class="text-[13px] text-text-secondary">
					{items.length === 1 ? '1 weekly chore' : `${items.length} weekly chores`} due on a later day
				</span>
			</span>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="size-[20px] shrink-0 text-text-secondary transition-transform group-open:rotate-180"
				aria-hidden="true"
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</summary>
		<ul class="flex flex-col gap-12 px-16 pb-16">
			{#each items as item (item.choreId)}
				<li>
					<ChoreCard
						href={item.href}
						title={item.title}
						subtitle={item.subtitle}
						variant={item.variant === 'highlighted' ? 'shared' : item.variant}
						points={item.points ?? undefined}
						icon={calendar}
					/>
				</li>
			{/each}
		</ul>
	</details>
{/if}
