<script lang="ts">
	import key from '#lib/assets/icons/key.svg';
	import { resetPassword } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import BackLink from '#lib/components/auth/BackLink.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import IconBadge from '#lib/components/auth/IconBadge.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Choose a new password · ChoreLoop</title></svelte:head>

<!-- Not in the Figma file; composed from the forgot-password screen's parts. -->
<AuthShell>
	<div class="flex flex-col gap-32">
		<BackLink href="/login" label="Back to sign in" />
		<div class="flex flex-col gap-16">
			<IconBadge src={key} />
			<AuthHeading title="Choose a new password">
				Set a new password for
				<strong class="font-bold text-text-primary">{data.email}</strong>.
			</AuthHeading>
		</div>

		<form {...resetPassword} class="flex flex-col gap-32">
			<!-- Lets password managers pair the new password with the account. -->
			<input
				type="email"
				value={data.email}
				autocomplete="username"
				readonly
				hidden
			/>
			<div class="flex flex-col gap-16">
				<FormAlert issues={resetPassword.fields.issues()} />
				<TextInput
					{...resetPassword.fields._password.as('password')}
					label="New password"
					autocomplete="new-password"
					placeholder="At least 8 characters"
					minlength={8}
					maxlength={128}
					required
				/>
			</div>
			<PrimaryButton type="submit" pending={resetPassword.pending > 0}>
				Update password
			</PrimaryButton>
		</form>
	</div>
</AuthShell>
