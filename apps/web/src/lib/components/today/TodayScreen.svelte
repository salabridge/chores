<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import ChoreCard from '#lib/components/ui/ChoreCard.svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import PointsPill from '#lib/components/ui/PointsPill.svelte';
	import PriorityCallout from '#lib/components/ui/PriorityCallout.svelte';
	import StreakBanner from '#lib/components/ui/StreakBanner.svelte';
	import SummaryTile from '#lib/components/ui/SummaryTile.svelte';
	import { plural } from '#lib/overview.js';
	import {
		streakNote,
		streakTitle,
		type TodayData,
		type TodayItem,
	} from '#lib/today.js';

	let { data }: { data: TodayData } = $props();

	// Chores the member can still act on today, for the streak banner's note.
	const stillToDo = $derived(
		data.summary.personalCount + data.rotations.filter((r) => r.myTurn).length,
	);
	const note = $derived(streakNote(data.streak, stillToDo));
</script>

{#snippet glyph(item: TodayItem, shared: boolean)}
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
		{#if item.status === 'completed'}
			<path d="M20 6 9 17l-5-5" />
		{:else if shared}
			<path d="m17 2 4 4-4 4" />
			<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
			<path d="m7 22-4-4 4-4" />
			<path d="M21 13v1a4 4 0 0 1-4 4H3" />
		{:else}
			<circle cx="12" cy="12" r="9" />
			<path d="m9 12 2 2 4-4" />
		{/if}
	</svg>
{/snippet}

{#snippet section(
	heading: string,
	tone: 'personal' | 'shared',
	items: TodayItem[],
	shared: boolean,
	empty: string,
)}
	<section class="flex flex-col gap-12" aria-labelledby="today-{tone}">
		<div class="flex items-center justify-between">
			<h2 id="today-{tone}" class="font-display text-[16px] font-bold text-text-primary">
				{heading}
			</h2>
			<Badge {tone} />
		</div>
		{#if items.length === 0}
			<p class="rounded-[16px] border border-border-subtle bg-surface-default p-16 text-[13px] text-text-secondary">
				{empty}
			</p>
		{:else}
			<ul class="flex flex-col gap-12">
				{#each items as item (item.choreId)}
					{#snippet icon()}{@render glyph(item, shared)}{/snippet}
					<li>
						<ChoreCard
							href={item.href}
							title={item.title}
							subtitle={item.subtitle}
							variant={item.variant}
							points={item.points ?? undefined}
							status={item.status ?? undefined}
							{icon}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/snippet}

<div class="flex flex-col gap-20 pb-24">
	<header class="flex flex-col gap-20 p-24 pb-0">
		<div class="flex items-center justify-between gap-12">
			<div class="flex min-w-0 items-center gap-12">
				<MemberAvatar name={data.member.name} />
				<div class="flex min-w-0 flex-col gap-2">
					<h1 class="truncate font-display text-[20px] font-bold text-text-primary">
						Hey {data.member.name}!
					</h1>
					<p class="text-[13px] text-text-secondary">Ready to spin the loop?</p>
				</div>
			</div>
			<PointsPill points={data.points} variant="header" />
		</div>
		<StreakBanner title={streakTitle(data.streak)} class="rounded-[12px]">
			{#if note}{note}{/if}
		</StreakBanner>
	</header>

	<div class="flex flex-col gap-20 px-24">
		<div class="flex gap-12">
			<SummaryTile
				class="flex-1"
				tone="orange"
				label="Personal"
				value={plural(data.summary.personalCount, 'chore')}
				caption="{data.summary.personalPoints} pts total"
			/>
			<SummaryTile
				class="flex-1"
				tone="blue"
				label="Shared"
				value={plural(data.summary.loopCount, 'loop')}
				caption="{data.summary.availablePoints} pts available"
			/>
		</div>

		{#if data.priority}
			<PriorityCallout title="Priority loop first">
				{data.priority.title} is active now and unlocks the biggest points win today.
			</PriorityCallout>
		{/if}

		{@render section(
			'My Personal Chores',
			'personal',
			data.personal,
			false,
			'Nothing personal on your list today.',
		)}
		{@render section(
			'Household Rotations',
			'shared',
			data.rotations,
			true,
			"You aren't part of any household rotations today.",
		)}
	</div>
</div>
