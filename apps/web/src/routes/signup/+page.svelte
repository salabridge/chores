<script lang="ts">
	import check from '#lib/assets/icons/check.svg';
	import { signUp } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import Logo from '#lib/components/ui/Logo.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SocialSignIn from '#lib/components/ui/SocialSignIn.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { SOCIAL_SIGN_IN_ENABLED } from '#lib/config.js';

	let { data } = $props();

	// See login/+page.svelte for why the submitted value wins.
	const redirectTo = $derived(
		signUp.fields.redirectTo.value() || data.redirectTo,
	);
</script>

<svelte:head><title>Create account · ChoreLoop</title></svelte:head>

<AuthShell>
	<div class="flex flex-col gap-24">
		<Logo />
		<AuthHeading title="Create account">
			Get your household set up and start sharing the chores.
		</AuthHeading>

		<form {...signUp} class="flex flex-col gap-24">
			<input {...signUp.fields.redirectTo.as('hidden', redirectTo)} />
			<div class="flex flex-col gap-14">
				<FormAlert issues={signUp.fields.issues()} />
				<TextInput
					{...signUp.fields.name.as('text')}
					label="Full name"
					autocomplete="name"
					placeholder="First and last name"
					required
				/>
				<TextInput
					{...signUp.fields.email.as('email')}
					label="Email"
					autocomplete="email"
					placeholder="you@example.com"
					required
				/>
				<TextInput
					{...signUp.fields._password.as('password')}
					label="Choose password"
					autocomplete="new-password"
					placeholder="At least 8 characters"
					minlength={8}
					maxlength={128}
					required
				/>
				<label class="flex items-start gap-10 pt-4 text-[13px] leading-[1.4]">
					<input
						{...signUp.fields.terms.as('checkbox')}
						required
						class="peer sr-only"
					/>
					<span
						class="flex size-[20px] shrink-0 items-center justify-center rounded-md border-2 border-border-orange bg-surface-accent-orange-subtle peer-focus-visible:ring-2 peer-focus-visible:ring-border-orange/30 peer-checked:[&>img]:visible"
					>
						<img src={check} alt="" width="10" height="10" class="invisible" />
					</span>
					<span class="text-text-secondary">
						I agree to the
						<a href="/terms" class="font-semibold text-text-orange">
							Terms of Service
						</a>
						and
						<a href="/privacy" class="font-semibold text-text-orange">
							Privacy Policy
						</a>
					</span>
				</label>
			</div>
			<PrimaryButton type="submit" pending={signUp.pending > 0}>Create free account</PrimaryButton>
		</form>

		{#if SOCIAL_SIGN_IN_ENABLED}
			<!-- TODO(oauth): call signIn.social({ provider, callbackURL: redirectTo }) once providers are enabled. -->
			<SocialSignIn onchoose={() => {}} />
		{/if}
	</div>

	{#snippet footer()}
		<p>
			<span class="text-text-secondary">Already have an account?</span>
			<a href="/login" class="font-semibold text-text-orange">Sign in</a>
		</p>
	{/snippet}
</AuthShell>
