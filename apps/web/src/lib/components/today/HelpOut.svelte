<script lang="ts">
	import ChoreCard from '#lib/components/ui/ChoreCard.svelte';
	import { plural } from '#lib/overview.js';
	import type { HelpOutItem } from '#lib/today.js';

	/**
	 * Other members' chores that are open now (SB-75), collapsed under one
	 * heading so they don't crowd the viewer's own list. Each card opens the
	 * chore as usual; doing it there gets the viewer the points.
	 */
	interface Props {
		items: HelpOutItem[];
		/** Expanded. Bindable; starts collapsed. */
		open?: boolean;
	}

	let { items, open = $bindable(false) }: Props = $props();
</script>

{#snippet hand()}
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
		<path
			d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
		/>
	</svg>
{/snippet}

{#if items.length > 0}
	<details
		bind:open
		class="group block min-w-0 rounded-[16px] border border-border-subtle bg-surface-default"
		data-testid="help-out"
	>
		<summary
			class="flex cursor-pointer list-none items-center justify-between gap-12 rounded-[16px] p-16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange [&::-webkit-details-marker]:hidden"
		>
			<span class="flex min-w-0 flex-col gap-2">
				<span class="font-display text-[17px] font-semibold text-text-primary lg:text-[20px]">
					Help out
				</span>
				<span class="text-[13px] text-text-secondary">
					{plural(items.length, 'open chore')} from others. Do one and the points are yours.
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
						variant="personal"
						points={item.points}
						status={item.overdue ? 'overdue' : undefined}
						icon={hand}
					/>
				</li>
			{/each}
		</ul>
	</details>
{/if}
