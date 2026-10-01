<script lang="ts">
	import BottomNav from '#lib/components/shell/BottomNav.svelte';
	import KidModeBar from '#lib/components/shell/KidModeBar.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();

	// A route opts out of the tab nav (e.g. the full-bleed completion screen)
	// by returning `{ hideNav: true }` from its `load`.
	const showNav = $derived(!page.data.hideNav);
</script>

<!-- Member-facing mobile shell. Protected via the (protected) group; see hooks.server.ts. -->
<div
	class="mx-auto flex min-h-dvh w-full max-w-[402px] flex-col"
	style:--shell-nav-height={showNav
		? 'calc(73px + env(safe-area-inset-bottom))'
		: '0px'}
>
	{#if data.activeKid}
		<KidModeBar name={data.activeKid.name} locked={data.activeKid.pinLocked} />
	{/if}
	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
	{#if showNav}
		<BottomNav pathname={page.url.pathname} />
	{/if}
</div>
