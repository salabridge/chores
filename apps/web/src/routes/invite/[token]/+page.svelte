<script lang="ts">
	import { signOut } from '#lib/auth.remote.js';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import InviteLanding from '#lib/components/invite/InviteLanding.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { page } from '$app/state';

	let { data } = $props();
</script>

<svelte:head>
	<title>Household invite · ChoreLoop</title>
	<!-- The token in the URL is a credential: keep it out of Referer headers and search indexes. -->
	<meta name="referrer" content="no-referrer" />
	<meta name="robots" content="noindex" />
</svelte:head>

<AuthShell>
	<InviteLanding
		invite={data.invite}
		token={data.token}
		signedInAs={data.signedInAs}
		problem={data.problem}
		signUpHref={data.signUpHref}
		signInHref={data.signInHref}
	>
		{#snippet switchAccount()}
			<form {...signOut}>
				<input {...signOut.fields.redirectTo.as('hidden', page.url.pathname)} />
				<SecondaryButton type="submit" pending={signOut.pending > 0}>
					Sign out and use another account
				</SecondaryButton>
			</form>
		{/snippet}
	</InviteLanding>
</AuthShell>
