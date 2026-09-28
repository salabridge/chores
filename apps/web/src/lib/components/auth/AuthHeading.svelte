<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="flex flex-col gap-8">
	<h1 class="font-display text-[28px] font-bold">{title}</h1>
	<p class="text-[15px] leading-normal text-text-secondary">
		{@render children()}
	</p>
</div>
