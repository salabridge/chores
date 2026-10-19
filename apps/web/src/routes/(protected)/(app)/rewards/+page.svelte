<script lang="ts">
	import { tick } from 'svelte';
	import BonusPointsCard from '#lib/components/rewards/BonusPointsCard.svelte';
	import ClaimConfirm from '#lib/components/rewards/ClaimConfirm.svelte';
	import HouseholdContribution from '#lib/components/rewards/HouseholdContribution.svelte';
	import MilestoneCard from '#lib/components/rewards/MilestoneCard.svelte';
	import MomentumCard from '#lib/components/rewards/MomentumCard.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import PointsPill from '#lib/components/ui/PointsPill.svelte';
	import RewardCard from '#lib/components/ui/RewardCard.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const shop = $derived(data.shop);
	let claiming = $state(false);
	let confirmEl = $state<HTMLElement>();

	// Bring the confirmation into view when Claim opens it.
	$effect(() => {
		if (data.confirming) {
			tick().then(() =>
				confirmEl?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
			);
		}
	});
</script>

<svelte:head><title>Rewards · ChoreLoop</title></svelte:head>

<div class="flex flex-col pb-[var(--shell-nav-height)]">
	<header class="flex flex-col gap-16 p-24">
		<div class="flex items-center justify-between gap-12">
			<h1 class="font-display text-[24px] font-bold text-text-primary">
				Rewards Shop
			</h1>
			<!-- From lg the shell header shows the balance (SB-68). -->
			<PointsPill class="lg:hidden" points={shop.balance} variant="header" />
		</div>
		<p class="text-[14px] text-text-secondary">
			See household progress, personal momentum, earned rewards, and the next
			milestones you can realistically unlock this week.
		</p>
	</header>

	<div class="flex flex-col gap-16 px-24 pb-24">
		{#if form?.message}
			<Callout tone="warning" role="alert">{form.message}</Callout>
		{:else if data.claimedTitle}
			<Callout tone="success" role="status">
				You claimed {data.claimedTitle}.
			</Callout>
		{/if}

		{#if data.gifts.length > 0}
			<BonusPointsCard gifts={data.gifts} />
		{/if}

		<HouseholdContribution
			loops={shop.household.loops}
			streakDays={shop.momentum.days}
			points={shop.household.points}
			summary={shop.household.summary}
		/>

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
				days={shop.momentum.days}
				goal={shop.momentum.goal}
				loopsLeft={shop.momentum.loopsLeft}
				percent={shop.momentum.percent}
				message={shop.momentum.message}
				chores={shop.momentum.chores}
			/>
		</section>

		<section class="flex flex-col gap-12" aria-labelledby="earned-heading">
			<div class="flex items-center justify-between">
				<h2
					id="earned-heading"
					class="font-display text-[16px] font-bold text-text-primary"
				>
					Earned rewards
				</h2>
				<Badge tone="earned">Earned</Badge>
			</div>
			{#if data.confirming}
				<form
					method="POST"
					action="?/claim"
					bind:this={confirmEl}
					use:enhance={() => {
						// Disabled while sending, so a double tap can't submit twice.
						claiming = true;
						return async ({ update }) => {
							await update();
							claiming = false;
						};
					}}
				>
					<ClaimConfirm
						title={data.confirming.title}
						cost={data.confirming.cost}
						balance={shop.balance}
						pending={claiming}
						cancelHref="/rewards"
					>
						<input type="hidden" name="rewardId" value={data.confirming.id} />
					</ClaimConfirm>
				</form>
			{/if}
			{#each shop.earned as reward (reward.id)}
				<RewardCard
					title={reward.title}
					description={reward.description ?? undefined}
					cost={reward.cost}
					status={reward.status}
					claimHref={reward.claimHref}
				/>
			{:else}
				<p class="text-[13px] text-text-secondary">
					Nothing to claim yet. Finish loops to earn points.
				</p>
			{/each}
		</section>

		{#if shop.saving.length > 0}
			<section class="flex flex-col gap-12" aria-labelledby="saving-heading">
				<h2
					id="saving-heading"
					class="font-display text-[16px] font-bold text-text-primary"
				>
					Saving up
				</h2>
				{#each shop.saving as reward (reward.id)}
					<RewardCard
						title={reward.title}
						description={reward.description ?? undefined}
						cost={reward.cost}
						status="locked"
					/>
				{/each}
			</section>
		{/if}

		{#if shop.milestones.length > 0}
			<section class="flex flex-col gap-12" aria-labelledby="milestones-heading">
				<div class="flex items-center justify-between">
					<h2
						id="milestones-heading"
						class="font-display text-[16px] font-bold text-text-primary"
					>
						Next milestones
					</h2>
					<Badge tone="reachable">Reachable</Badge>
				</div>
				{#each shop.milestones as milestone (milestone.id)}
					<MilestoneCard
						title={milestone.title}
						description={milestone.description}
						current={milestone.current}
						needed={milestone.target}
						nextUp={milestone.nextUp}
						reached={milestone.reached}
						note={milestone.note}
					/>
				{/each}
			</section>
		{/if}
	</div>
</div>
