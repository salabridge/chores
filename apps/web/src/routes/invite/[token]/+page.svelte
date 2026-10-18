<script lang="ts">
	import { sendVerificationCode, signOut } from '#lib/auth.remote.js';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import InviteLanding from '#lib/components/invite/InviteLanding.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
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
		{#snippet verifyEmail()}
			<form {...sendVerificationCode} class="flex flex-col gap-16">
				<FormAlert issues={sendVerificationCode.fields.issues()} />
				<input
					{...sendVerificationCode.fields.redirectTo.as('hidden', page.url.pathname)}
				/>
				<PrimaryButton type="submit" pending={sendVerificationCode.pending > 0}>
					Send a code to {data.signedInAs}
				</PrimaryButton>
			</form>
		{/snippet}
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
