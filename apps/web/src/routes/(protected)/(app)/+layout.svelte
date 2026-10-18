<script lang="ts">
	import AppHeader from '#lib/components/shell/AppHeader.svelte';
	import BottomNav from '#lib/components/shell/BottomNav.svelte';
	import KidModeBar from '#lib/components/shell/KidModeBar.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();

	// A route opts out of the nav (e.g. the full-bleed completion screen) by
	// returning `{ hideNav: true }` from its `load`. Without the nav there's
	// no desktop header either.
	const showNav = $derived(!page.data.hideNav);
	// A route with a desktop design returns `{ wide: true }` to leave the
	// phone column from lg; its content then caps at the mock's 1312px.
	const wide = $derived(page.data.wide === true);
</script>

<!--
	Member-facing shell. Protected via the (protected) group; see hooks.server.ts.
	Below lg it's the phone column with the bottom tab bar. From lg (SB-68) the
	header and kid-mode bar span the window and the tabs move into the header;
	pages stay in the phone column until they get desktop designs (`wide`).
-->
<div
	class={[
		'mx-auto flex min-h-dvh w-full max-w-[402px] flex-col lg:max-w-none',
		showNav
			? '[--shell-nav-height:calc(73px_+_env(safe-area-inset-bottom))] lg:[--shell-nav-height:0px]'
			: '[--shell-nav-height:0px]',
	]}
>
	{#if data.activeKid}
		<KidModeBar name={data.activeKid.name} locked={data.activeKid.pinLocked} />
	{/if}
	{#if showNav}
		<AppHeader
			class="sticky top-0 z-20 hidden lg:grid"
			pathname={page.url.pathname}
			member={data.shellMember}
		/>
	{/if}
	<main
		class={[
			'mx-auto flex w-full max-w-[402px] flex-1 flex-col',
			wide && 'lg:max-w-[1440px] lg:px-[64px] lg:pt-40 lg:pb-[56px]',
		]}
	>
		{@render children()}
	</main>
	{#if showNav}
		<BottomNav class="lg:hidden" pathname={page.url.pathname} />
	{/if}
</div>
