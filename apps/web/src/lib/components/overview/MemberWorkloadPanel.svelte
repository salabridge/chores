<script lang="ts">
	import type { MemberWorkload, WorkloadOverview } from '#lib/overview.js';
	import Badge from '../ui/Badge.svelte';
	import MemberAvatar from '../ui/MemberAvatar.svelte';
	import ProgressBar from '../ui/ProgressBar.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	let { workload }: { workload: WorkloadOverview } = $props();

	const variantFor = (m: MemberWorkload) =>
		m.active > 0 ? 'orange' : m.done > 0 ? 'green' : 'blue';
	const countClass = (m: MemberWorkload) =>
		m.active > 0
			? 'text-text-orange'
			: m.done > 0
				? 'text-text-green'
				: 'text-text-secondary';
</script>

<SurfaceCard
	title="Member Workload"
	subtitle="Today's live load across active and completed chores."
	data-testid="member-workload"
>
	{#snippet badge()}
		<Badge tone={workload.balance === 'balanced' ? 'required' : 'this-week'}>
			{workload.balance === 'balanced' ? 'Balanced' : 'Unbalanced'}
		</Badge>
	{/snippet}
	{#if workload.members.length === 0}
		<p class="text-[13px] text-text-secondary">No household members yet.</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-14 p-0">
			{#each workload.members as member (member.memberId)}
				<li class="flex items-center gap-12" data-member={member.name}>
					<MemberAvatar name={member.name} size="sm" class="size-[36px]" />
					<div class="flex min-w-0 flex-1 flex-col gap-6">
						<div class="flex items-center justify-between gap-8">
							<span
								class="font-display text-[14px] font-semibold text-text-primary"
								>{member.name}</span
							>
							<span class={['text-[12px] font-semibold', countClass(member)]}>
								{member.active} active / {member.done} done
							</span>
						</div>
						<ProgressBar
							value={member.barPercent}
							variant={variantFor(member)}
							aria-label="{member.name}'s share of today's chores"
						/>
						<p class="text-[12px] text-text-secondary">{member.summary}</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</SurfaceCard>
