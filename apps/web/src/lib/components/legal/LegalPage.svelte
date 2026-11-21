<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from '#lib/components/ui/Logo.svelte';

	let {
		title,
		lastUpdated,
		children,
	}: {
		title: string;
		/** Human-readable date, e.g. "30 October 2026". */
		lastUpdated: string;
		children: Snippet;
	} = $props();

	const linkClass =
		'rounded-[4px] font-semibold text-text-orange hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange';
</script>

<div class="min-h-dvh bg-background-base">
	<header
		class="flex h-[80px] items-center border-b border-border-subtle px-24 lg:h-[88px] lg:px-[120px]"
	>
		<Logo />
	</header>
	<main class="mx-auto flex w-full max-w-[720px] flex-col gap-16 px-24 py-32 lg:py-48">
		<h1 class="font-display text-[28px] font-bold lg:text-[36px]">{title}</h1>
		<p class="text-[14px] text-text-secondary">Last updated: {lastUpdated}</p>
		<div
			class="flex flex-col gap-16 text-[15px] leading-[1.6] text-text-secondary [&_h2]:mt-16 [&_h2]:font-display [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:text-text-primary [&_li]:pl-4 [&_strong]:font-semibold [&_strong]:text-text-primary [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-8 [&_ul]:pl-24"
		>
			{@render children()}
		</div>
	</main>
	<footer class="border-t border-border-subtle px-24 py-24 lg:px-[120px]">
		<nav
			aria-label="Legal"
			class="flex justify-center gap-24 text-[14px]"
		>
			<a href="/privacy" class={linkClass}>Privacy Policy</a>
			<a href="/terms" class={linkClass}>Terms of Service</a>
		</nav>
	</footer>
</div>
