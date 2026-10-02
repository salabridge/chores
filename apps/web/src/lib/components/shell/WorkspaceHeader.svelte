<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		actions,
	}: {
		title: string;
		subtitle?: string;
		/** Trailing actions, e.g. a SecondaryButton and a PrimaryButton. */
		actions?: Snippet;
	} = $props();
</script>

<header class="flex flex-wrap items-center justify-between gap-16">
	<div class="flex max-w-[560px] min-w-0 flex-col gap-4">
		<h1 class="font-display text-[28px] font-bold text-text-primary">{title}</h1>
		{#if subtitle}
			<p class="text-[14px] text-text-secondary">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex items-center gap-12">
			{@render actions()}
		</div>
	{/if}
</header>
