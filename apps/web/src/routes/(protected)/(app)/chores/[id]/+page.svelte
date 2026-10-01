<script lang="ts">
	import PageHeader from '#lib/components/shell/PageHeader.svelte';
	import StickyActionBar from '#lib/components/shell/StickyActionBar.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import { page } from '$app/state';

	const id = $derived(page.params.id);
</script>

<svelte:head><title>Chore · ChoreLoop</title></svelte:head>

<PageHeader label="Personal Chore" />

<div class="flex flex-1 flex-col gap-8 p-24">
	<p class="text-[14px] text-text-secondary">Chore {id} details coming soon.</p>
</div>

<StickyActionBar>
	{#snippet summary()}Reward after all 3 stages · 15 pts{/snippet}
	<PrimaryButton href="/chores/{id}/complete">Start</PrimaryButton>
</StickyActionBar>
