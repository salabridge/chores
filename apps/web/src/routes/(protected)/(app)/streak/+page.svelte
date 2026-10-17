<script lang="ts">
	import StreakScreen from '#lib/components/streak/StreakScreen.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Streak · ChoreLoop</title></svelte:head>

{#if data.streak}
	<StreakScreen data={data.streak} />
{:else}
	<div class="flex flex-col gap-8 p-24">
		<h1 class="font-display text-[24px] font-bold text-text-primary">Streak</h1>
		<p class="text-[14px] text-text-secondary">
			You aren't part of a household yet. Once you create or join one, your
			streaks will show up here.
		</p>
	</div>
{/if}
