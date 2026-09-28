<script lang="ts">
	import shield from '#lib/assets/icons/shield.svg';
	import { resendCode, verifyCode } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import BackLink from '#lib/components/auth/BackLink.svelte';
	import CodeInput from '#lib/components/auth/CodeInput.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import IconBadge from '#lib/components/auth/IconBadge.svelte';
	import SubmitButton from '#lib/components/auth/SubmitButton.svelte';

	let { data } = $props();

	// See login/+page.svelte for why the submitted value wins.
	const redirectTo = $derived(
		verifyCode.fields.redirectTo.value() || data.redirectTo,
	);

	const back = $derived(
		{
			'forget-password': { href: '/forgot-password', label: 'Back to reset' },
			'email-verification': { href: '/signup', label: 'Back to sign up' },
			'sign-in': { href: '/login/code', label: 'Back to sign in' },
		}[data.purpose],
	);

	const RESEND_COOLDOWN = 45;
	// Starts at 0 so the button works without JS; the countdown only runs once
	// hydrated, since a code was just sent to get here.
	let cooldown = $state(0);
	$effect(() => {
		cooldown = RESEND_COOLDOWN;
		const timer = setInterval(() => {
			if (cooldown > 0) cooldown -= 1;
		}, 1000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		if (resendCode.result?.sent) cooldown = RESEND_COOLDOWN;
	});
</script>

<svelte:head><title>Check your email · ChoreLoop</title></svelte:head>

<AuthShell>
	<div class="flex flex-col gap-32">
		<BackLink {...back} />
		<div class="flex flex-col gap-16">
			<IconBadge src={shield} />
			<AuthHeading title="Check your email">
				We sent a code to
				<strong class="font-bold text-text-primary">{data.email}</strong>.
				{data.purpose === 'email-verification'
					? 'Enter it below to finish signing up.'
					: 'Enter it below to proceed.'}
			</AuthHeading>
		</div>

		<form {...verifyCode} class="flex flex-col gap-24">
			<input {...verifyCode.fields.redirectTo.as('hidden', redirectTo)} />
			<FormAlert issues={verifyCode.fields.issues()} />
			<CodeInput
				{...verifyCode.fields.otp.as('text')}
				label="6-digit code"
				required
			/>
			<SubmitButton pending={verifyCode.pending > 0}>Verify code</SubmitButton>
		</form>
	</div>

	{#snippet footer()}
		<form {...resendCode} class="flex flex-col items-center gap-8">
			{#if resendCode.result?.sent}
				<p role="status" class="text-text-secondary">Sent a new code.</p>
			{:else}
				<p class="text-text-secondary">Haven't received the email?</p>
			{/if}
			<FormAlert issues={resendCode.fields.issues()} />
			<button
				type="submit"
				disabled={cooldown > 0 || resendCode.pending > 0}
				class="font-semibold text-text-orange disabled:opacity-60"
			>
				Resend code{cooldown > 0 ? ` (${cooldown}s)` : ''}
			</button>
		</form>
	{/snippet}
</AuthShell>
