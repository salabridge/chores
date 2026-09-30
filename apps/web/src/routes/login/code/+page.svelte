<script lang="ts">
	import shield from '#lib/assets/icons/shield.svg';
	import { sendSignInCode } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import BackLink from '#lib/components/auth/BackLink.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import IconBadge from '#lib/components/auth/IconBadge.svelte';
	import TextField from '#lib/components/auth/TextField.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';

	let { data } = $props();

	// See login/+page.svelte for why the submitted value wins.
	const redirectTo = $derived(
		sendSignInCode.fields.redirectTo.value() || data.redirectTo,
	);
</script>

<svelte:head><title>Sign in with a code · ChoreLoop</title></svelte:head>

<AuthShell>
	<div class="flex flex-col gap-32">
		<BackLink href="/login" label="Back to sign in" />
		<div class="flex flex-col gap-16">
			<IconBadge src={shield} />
			<AuthHeading title="Sign in with a code">
				Enter your email and we'll send you a 6-digit code to sign in with.
			</AuthHeading>
		</div>

		<form {...sendSignInCode} class="flex flex-col gap-32">
			<input {...sendSignInCode.fields.redirectTo.as('hidden', redirectTo)} />
			<div class="flex flex-col gap-16">
				<FormAlert issues={sendSignInCode.fields.issues()} />
				<TextField
					{...sendSignInCode.fields.email.as('email')}
					label="Email address"
					autocomplete="email"
					placeholder="you@example.com"
					required
				/>
			</div>
			<PrimaryButton type="submit" pending={sendSignInCode.pending > 0}>
				Send sign-in code
			</PrimaryButton>
		</form>
	</div>
</AuthShell>
