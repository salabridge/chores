<script lang="ts">
	import { setPassword, signOut } from '#lib/auth.remote.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import AuthShell from '#lib/components/auth/AuthShell.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import Logo from '#lib/components/ui/Logo.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';

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

		<form
			{...setPassword.enhance(async (form) => {
				if (await form.submit()) form.element.reset();
			})}
			class="flex flex-col gap-16"
		>
			<h2 class="text-[16px] font-bold">Change password</h2>
			<FormAlert issues={setPassword.fields.issues()} />
			{#if setPassword.result?.changed}
				<FormAlert tone="status" issues={[{ message: 'Password updated.' }]} />
			{/if}
			<!-- Lets password managers pair the new password with the account. -->
			<input
				type="email"
				value={data.user?.email}
				autocomplete="username"
				readonly
				hidden
			/>
			<TextInput
				{...setPassword.fields._currentPassword.as('password')}
				label="Current password"
				autocomplete="current-password"
				required
			/>
			<TextInput
				{...setPassword.fields._newPassword.as('password')}
				label="New password"
				autocomplete="new-password"
				placeholder="At least 8 characters"
				minlength={8}
				maxlength={128}
				required
			/>
			<PrimaryButton type="submit" pending={setPassword.pending > 0}>
				Update password
			</PrimaryButton>
		</form>

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
