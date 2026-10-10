<script lang="ts">
	import NavLinkCard from '../ui/NavLinkCard.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	let {
		createHref = '/chores/new',
		rotationsHref = '/rotations',
		overviewHref = '/overview',
	}: {
		createHref?: string;
		rotationsHref?: string;
		overviewHref?: string;
	} = $props();
</script>

{#snippet plus()}
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block text-text-orange" aria-hidden="true">
		<path d="M12 5v14M5 12h14" />
	</svg>
{/snippet}
{#snippet refresh()}
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block text-text-blue" aria-hidden="true">
		<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
	</svg>
{/snippet}
{#snippet grid()}
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block text-text-secondary" aria-hidden="true">
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
	</svg>
{/snippet}

<SurfaceCard
	title="Manage Chores"
	subtitle="Clear paths to create, assign, and tune household loops."
	data-testid="manage-chores"
>
	<div class="flex flex-col gap-12">
		<NavLinkCard
			href={createHref}
			tone="orange"
			title="Create & Assign"
			description="Add a new chore and decide who can take it."
			icon={plus}
		/>
		<NavLinkCard
			href={rotationsHref}
			tone="blue"
			title="Rotation Builder"
			description="Tune who rotates, when it resets, and who is excluded."
			icon={refresh}
		/>
		<NavLinkCard
			href={overviewHref}
			tone="neutral"
			title="Overview"
			description="Review status, workload, exceptions, and upcoming handoffs."
			icon={grid}
		/>
	</div>
</SurfaceCard>
