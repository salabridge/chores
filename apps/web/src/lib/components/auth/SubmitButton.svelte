<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		pending = false,
	}: {
		children: Snippet;
		/** Disables the button while its form is submitting. */
		pending?: boolean;
	} = $props();
</script>

<button
	type="submit"
	disabled={pending}
	aria-busy={pending}
	class="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-accent-orange text-[16px] font-semibold text-text-default transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60"
>
	{@render children()}
</button>
