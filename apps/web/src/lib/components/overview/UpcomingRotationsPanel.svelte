<script lang="ts">
	import type { UpcomingRotation } from '#lib/overview.js';
	import Badge from '../ui/Badge.svelte';
	import RotationOrderPreview from '../ui/RotationOrderPreview.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	let {
		rotations,
		loopHref = '/rotations',
	}: { rotations: UpcomingRotation[]; loopHref?: string } = $props();

	const dueToday = $derived(rotations.filter((r) => r.dueToday).length);
</script>

<SurfaceCard
	title="Upcoming Rotations"
	subtitle="Next turns, loop reset points, and who is next in line."
	data-testid="upcoming-rotations"
>
	{#snippet badge()}
		<Badge tone="reachable">{dueToday} due today</Badge>
	{/snippet}
	{#if rotations.length === 0}
		<p class="text-[13px] text-text-secondary">
			No active rotations yet. Build a loop to see who is up next.
		</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-12 p-0">
			{#each rotations as rotation (rotation.choreId)}
				<li
					class="flex flex-wrap items-center gap-16 rounded-[12px] bg-background-base p-16"
					data-rotation={rotation.title}
				>
					<div class="flex w-[220px] max-w-full flex-col gap-4">
						<span
							class="font-display text-[14px] font-semibold text-text-primary"
							>{rotation.title}</span
						>
						<span class="text-[12px] text-text-secondary"
							>{rotation.handoff}</span
						>
					</div>
					<RotationOrderPreview
						class="min-w-0 flex-1"
						members={rotation.order.map((name) => ({ name }))}
					/>
					<SecondaryButton
						variant="tinted"
						tone="neutral"
						href={loopHref}
						aria-label="View Loop: {rotation.title}"
					>
						View Loop
					</SecondaryButton>
				</li>
			{/each}
		</ul>
	{/if}
</SurfaceCard>
