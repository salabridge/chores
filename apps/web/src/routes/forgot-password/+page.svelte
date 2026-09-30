<script lang="ts">
	import key from '#lib/assets/icons/key.svg';
	import { requestPasswordReset } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import BackLink from '#lib/components/auth/BackLink.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import IconBadge from '#lib/components/auth/IconBadge.svelte';
	import TextField from '#lib/components/auth/TextField.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
</script>

<svelte:head><title>Reset password · ChoreLoop</title></svelte:head>

<AuthShell>
	<div class="flex flex-col gap-32">
		<BackLink href="/login" label="Back to sign in" />
		<div class="flex flex-col gap-16">
			<IconBadge src={key} />
			<AuthHeading title="Reset password">
				Enter the email associated with your account and we'll send you a
				6-digit verification code.
			</AuthHeading>
		</div>

		<form {...requestPasswordReset} class="flex flex-col gap-32">
			<div class="flex flex-col gap-16">
				<FormAlert issues={requestPasswordReset.fields.issues()} />
				<TextField
					{...requestPasswordReset.fields.email.as('email')}
					label="Email address"
					autocomplete="email"
					placeholder="you@example.com"
					required
				/>
			</div>
			<PrimaryButton type="submit" pending={requestPasswordReset.pending > 0}>
				Send verification code
			</PrimaryButton>
		</form>
	</div>
</AuthShell>
