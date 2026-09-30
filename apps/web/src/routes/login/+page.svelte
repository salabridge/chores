<script lang="ts">
	import { signIn } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import Logo from '#lib/components/auth/Logo.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';

	let { data } = $props();

	// After a no-JS submit the page re-renders at the form's action URL, which
	// drops ?redirectTo, so prefer the value that was just submitted.
	const redirectTo = $derived(
		signIn.fields.redirectTo.value() || data.redirectTo,
	);
</script>

<svelte:head><title>Sign in · ChoreLoop</title></svelte:head>

<AuthShell pinFooter={false}>
	<div class="flex flex-col gap-32">
		<Logo />
		<AuthHeading title="Welcome back">
			Sign in to keep your household's chores on track.
		</AuthHeading>

		<form {...signIn} class="flex flex-col gap-32">
			<input {...signIn.fields.redirectTo.as('hidden', redirectTo)} />
			<div class="flex flex-col gap-16">
				{#if data.passwordReset}
					<FormAlert
						tone="status"
						issues={[{ message: 'Password updated. Sign in with your new password.' }]}
					/>
				{/if}
				<FormAlert issues={signIn.fields.issues()} />
				<TextInput
					{...signIn.fields.email.as('email')}
					label="Email address"
					autocomplete="email"
					placeholder="you@example.com"
					required
				/>
				<TextInput
					{...signIn.fields._password.as('password')}
					label="Password"
					autocomplete="current-password"
					required
				/>
				<div class="flex justify-end">
					<a
						href="/forgot-password"
						class="text-[14px] font-semibold text-text-orange"
					>
						Forgot?
					</a>
				</div>
			</div>
			<PrimaryButton type="submit" pending={signIn.pending > 0}>Sign In</PrimaryButton>
		</form>

		<a
			href="/login/code{data.redirectTo === '/'
				? ''
				: `?redirectTo=${encodeURIComponent(data.redirectTo)}`}"
			class="text-center text-[14px] font-semibold text-text-orange"
		>
			Email me a sign-in code instead
		</a>
	</div>

	{#snippet footer()}
		<p>
			<span class="text-text-secondary">Don't have an account?</span>
			<a href="/signup" class="font-semibold text-text-orange">Sign up</a>
		</p>
	{/snippet}
</AuthShell>
