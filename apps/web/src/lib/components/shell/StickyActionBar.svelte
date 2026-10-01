<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		summary,
	}: {
		/** The primary CTA, typically a `PrimaryButton`. */
		children: Snippet;
		/** Optional summary row above the CTA, e.g. "Reward after all 3 stages · 15 pts". */
		summary?: Snippet;
	} = $props();
</script>

<!-- Pins above the bottom nav: the shell layout sets --shell-nav-height. -->
<div
	class="sticky bottom-[var(--shell-nav-height,0px)] z-10 flex flex-col gap-12 bg-background-base px-24 pt-12 pb-16"
>
	{#if summary}
		<p class="text-center text-[13px] font-medium text-text-secondary">
			{@render summary()}
		</p>
	{/if}
	{@render children()}
</div>
