<script lang="ts">
	import CompletionCelebration from '#lib/components/chores/CompletionCelebration.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Done · ChoreLoop</title></svelte:head>

<CompletionCelebration summary={data.summary} />
