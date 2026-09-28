<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		footer,
		pinFooter = true,
	}: {
		children: Snippet;
		footer?: Snippet;
		/** Push the footer to the bottom of the screen instead of straight after
		 * the content (the sign-in design keeps it close). */
		pinFooter?: boolean;
	} = $props();
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-[402px] flex-col">
	<main class="flex flex-col px-24 pt-24 sm:pt-40">
		{@render children()}
	</main>
	{#if footer}
		<footer
			class={[
				'flex flex-col items-center gap-8 p-24 text-[14px]',
				pinFooter && 'mt-auto',
			]}
		>
			{@render footer()}
		</footer>
	{/if}
</div>
