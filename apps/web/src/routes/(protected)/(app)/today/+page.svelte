<script lang="ts">
	import TodayScreen from '#lib/components/today/TodayScreen.svelte';
	import { favourActions } from '#lib/favour-client.js';

	let { data } = $props();
</script>

<svelte:head><title>Today · ChoreLoop</title></svelte:head>

{#if data.today}
	<TodayScreen data={data.today} favours={data.favours} {favourActions} />
{:else}
	<div class="flex flex-col gap-8 p-24">
		<h1 class="font-display text-[24px] font-bold text-text-primary">Today</h1>
		<p class="text-[14px] text-text-secondary">
			You aren't part of a household yet. Once you create or join one, your
			chores will show up here.
		</p>
	</div>
{/if}
