<script lang="ts">
	import MomentumCard from '#lib/components/rewards/MomentumCard.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import PointsPill from '#lib/components/ui/PointsPill.svelte';
	import type { StreakScreenData } from '#lib/streak.js';
	import ActiveStreakCard from './ActiveStreakCard.svelte';
	import WeeklyActivity from './WeeklyActivity.svelte';

	let { data }: { data: StreakScreenData } = $props();
</script>

<div class="flex flex-col pb-[var(--shell-nav-height)]">
	<header class="flex flex-col gap-16 p-24">
		<div class="flex items-center justify-between gap-12">
			<h1 class="font-display text-[24px] font-bold text-text-primary">
				Your Streak
			</h1>
			<!-- From lg the shell header shows the balance (SB-68). -->
			<PointsPill class="lg:hidden" points={data.points} variant="header" />
		</div>
		<p class="text-[14px] text-text-secondary">
			Small steps, strong momentum. Keep your loop going, {data.name}!
		</p>
	</header>

	<div class="flex flex-col gap-20 px-24 pb-24">
		<ActiveStreakCard
			days={data.streak.days}
			exceptions={data.streak.exceptions}
			goal={data.goal}
			note={data.note}
		/>

		<WeeklyActivity week={data.week} />

		<section class="flex flex-col gap-12" aria-labelledby="momentum-heading">
			<div class="flex items-center justify-between">
				<h2
					id="momentum-heading"
					class="font-display text-[16px] font-bold text-text-primary"
				>
					Personal momentum
				</h2>
				<Badge tone="personal">You</Badge>
			</div>
			<MomentumCard
				days={data.momentum.days}
				goal={data.momentum.goal}
				loopsLeft={data.momentum.loopsLeft}
				percent={data.momentum.percent}
				message={data.momentum.message}
				chores={data.momentum.chores}
			/>
		</section>
	</div>
</div>
