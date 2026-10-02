<script lang="ts">
	import { onMount } from 'svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import ParentPinDialog from './ParentPinDialog.svelte';

	let { name, locked = false }: { name: string; locked?: boolean } = $props();

	let pinOpen = $state(false);

	// Keeps the parent's session from expiring quietly while the device sits in
	// a kid profile: each ping reaches `hooks.server.ts`, which asks Neon Auth
	// for the session and so slides its expiry forward. See "Kid profiles" in
	// the web README for why this beats a separate kid-mode token.
	const KEEP_ALIVE_MS = 15 * 60 * 1000;
	onMount(() => {
		const ping = () => fetch('/api/keep-alive').catch(() => {});
		const timer = setInterval(ping, KEEP_ALIVE_MS);
		const onVisible = () => {
			if (document.visibilityState === 'visible') ping();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<div
	class="flex items-center justify-between gap-12 border-b border-border-subtle bg-surface-accent-orange-subtle px-24 py-8"
	data-testid="kid-mode-bar"
>
	<div class="flex min-w-0 items-center gap-8">
		<MemberAvatar {name} size="sm" />
		<p class="truncate text-[14px] font-semibold">
			<span class="text-text-secondary">Playing as</span>
			{name}
		</p>
	</div>
	<SecondaryButton onclick={() => (pinOpen = true)}>Switch profile</SecondaryButton>
</div>

<ParentPinDialog bind:open={pinOpen} memberName={name} {locked} />
