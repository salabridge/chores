<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import ChoreCard from '#lib/components/ui/ChoreCard.svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import PointsPill from '#lib/components/ui/PointsPill.svelte';
	import PriorityCallout from '#lib/components/ui/PriorityCallout.svelte';
	import StreakBanner from '#lib/components/ui/StreakBanner.svelte';
	import SummaryTile from '#lib/components/ui/SummaryTile.svelte';
	import WeeklyProgressCard from '#lib/components/ui/WeeklyProgressCard.svelte';
	import { plural } from '#lib/overview.js';
	import {
		choreHref,
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
	<section class="flex min-w-0 flex-col gap-12" aria-labelledby="today-{tone}">
		<div class="flex items-center justify-between">
			<h2
				id="today-{tone}"
				class="font-display text-[17px] font-semibold text-text-primary lg:text-[20px]"
			>
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

<!--
	One DOM for both widths (SB-68): below lg it's the Today · Mobile frame;
	from lg the shell header takes over the greeting and the sections spread
	into the Today · Desktop grid, in the same reading order.
-->
<div class="flex flex-col gap-20 px-20 pt-20 pb-24 lg:gap-24 lg:p-0">
	<!-- From lg the shell header shows the greeting and the balance. -->
	<div class="flex items-center justify-between gap-12 lg:hidden">
		<div class="flex min-w-0 items-center gap-12">
			<MemberAvatar name={data.member.name} />
			<div class="flex min-w-0 flex-col gap-2">
				<p class="truncate font-display text-[20px] font-bold text-text-primary">
					Hey {data.member.name}!
				</p>
				<p class="text-[12px] text-text-secondary">Ready to spin the loop?</p>
			</div>
		</div>
		<PointsPill points={data.points} variant="header" />
	</div>

	<div class="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-24">
		<h1 class="font-display text-[30px] font-semibold text-text-primary lg:text-[40px]">
			Today
		</h1>
		<StreakBanner title={streakTitle(data.streak)} class="rounded-[8px] lg:w-[394px]">
			{#if note}{note}{/if}
		</StreakBanner>
	</div>

	<div class="grid grid-cols-2 gap-x-12 gap-y-20 lg:grid-cols-[356fr_356fr_560fr] lg:gap-20">
		<SummaryTile
			size="large"
			tone="orange"
			label="Personal"
			value={plural(data.summary.personalCount, 'chore')}
			caption="{data.summary.personalPoints} pts total"
		/>
		<SummaryTile
			size="large"
			tone="blue"
			label="Shared"
			value={plural(data.summary.loopCount, 'loop')}
			caption="{data.summary.availablePoints} pts available"
		/>
		<WeeklyProgressCard
			class="col-span-2 lg:col-span-1 lg:p-20"
			label={data.week.label}
			number={data.week.number}
			done={data.week.done}
			due={data.week.due}
			points={data.week.points}
		/>
	</div>

	{#if data.priority}
		<PriorityCallout title="Priority loop first" href={choreHref(data.priority.choreId)}>
			{data.priority.title} is active now and unlocks the biggest points win today.
		</PriorityCallout>
	{/if}

	<div class="grid gap-20 lg:grid-cols-2 lg:gap-24">
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
