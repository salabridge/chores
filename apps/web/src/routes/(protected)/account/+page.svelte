<script lang="ts">
	import { signOut } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import Logo from '#lib/components/ui/Logo.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Account · ChoreLoop</title></svelte:head>

<!-- Everything under (protected) requires a session; see hooks.server.ts. -->
<AuthShell>
	<div class="flex flex-col gap-32">
		<Logo />
		<AuthHeading title="Account">
			Signed in as
			<strong class="font-bold text-text-primary">{data.user?.name}</strong>
			({data.user?.email}).
		</AuthHeading>

		<form {...signOut}>
			<button
				type="submit"
				disabled={signOut.pending > 0}
				class="flex h-[48px] w-full items-center justify-center rounded-xl border border-border-orange bg-surface-accent-orange-subtle text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60"
			>
				Sign out
			</button>
		</form>
	</div>
</AuthShell>
