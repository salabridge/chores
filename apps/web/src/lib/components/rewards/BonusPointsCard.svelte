<script lang="ts">
	import { type GiftItem, giftLine } from '#lib/gift.js';
	import Badge from '../ui/Badge.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	let {
		gifts,
		class: className,
	}: {
		/** Bonus points from a parent, newest first (SB-78). */
		gifts: GiftItem[];
		class?: string;
	} = $props();

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
		});
</script>

<SurfaceCard
	title="Bonus points"
	subtitle="Extra points a parent gave you. They count toward your balance, not your weekly goal."
	class={className}
	data-testid="bonus-points"
>
	{#snippet badge()}
		<Badge tone="earned">Gift</Badge>
	{/snippet}
	<ul class="m-0 flex list-none flex-col gap-12 p-0">
		{#each gifts as gift (gift.id)}
			<li class="flex items-baseline justify-between gap-12">
				<span class="min-w-0 text-[14px] font-semibold text-text-primary">
					{giftLine(gift)}
				</span>
				<time
					datetime={gift.createdAt}
					class="shrink-0 text-[12px] text-text-secondary"
				>
					{formatDate(gift.createdAt)}
				</time>
			</li>
		{/each}
	</ul>
</SurfaceCard>
