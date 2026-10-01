<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import SetPinForm from '#lib/components/profiles/SetPinForm.svelte';
	import PinPad from '#lib/components/ui/PinPad.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import {
		getPinStatus,
		leaveKidProfile,
		unlockPin,
	} from '#lib/profiles.remote.js';

	let {
		open = $bindable(false),
		memberName,
	}: {
		open?: boolean;
		/** The kid whose profile is open, named in the prompt. */
		memberName: string;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let pin = $state('');
	const status = getPinStatus();
	const locked = $derived(status.current?.locked ?? false);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="parent-pin-title"
	onclose={() => (open = false)}
	class="m-auto w-[min(360px,calc(100vw-32px))] rounded-[16px] border border-border-subtle bg-surface-default p-24 text-text-primary backdrop:bg-black/50"
>
	<div class="flex flex-col gap-16">
		<div class="flex flex-col gap-4">
			<h2 id="parent-pin-title" class="font-display text-[20px] font-bold">
				Parent PIN
			</h2>
			<p class="text-[14px] text-text-secondary">
				Enter your PIN to leave {memberName}'s profile.
			</p>
		</div>

		{#if locked}
			<form
				{...unlockPin.enhance(async (form) => {
					if (await form.submit()) form.element.reset();
					await status.refresh();
				})}
				class="flex flex-col gap-16"
			>
				<FormAlert
					issues={[
						{
							message:
								'Too many wrong PINs. Enter your account password to unlock.',
						},
					]}
				/>
				<FormAlert issues={unlockPin.fields.issues()} />
				<TextInput
					{...unlockPin.fields._password.as('password')}
					label="Account password"
					autocomplete="current-password"
					required
				/>
				<PrimaryButton type="submit" pending={unlockPin.pending > 0}>
					Unlock
				</PrimaryButton>
			</form>
		{:else}
			<form
				{...leaveKidProfile.enhance(async (form) => {
					await form.submit();
					pin = '';
					await status.refresh();
				})}
				class="flex flex-col gap-16"
			>
				<input {...leaveKidProfile.fields.target.as('hidden', 'parent')} />
				<FormAlert issues={leaveKidProfile.fields.issues()} />
				<PinPad
					{...leaveKidProfile.fields._pin.as('password')}
					label="Parent PIN"
					bind:value={pin}
				/>
				<PrimaryButton type="submit" pending={leaveKidProfile.pending > 0}>
					Switch profile
				</PrimaryButton>
			</form>
		{/if}

		<details class="text-[14px]">
			<summary class="cursor-pointer font-semibold text-text-orange">
				Forgot your PIN?
			</summary>
			<div class="flex flex-col gap-16 pt-16">
				<p class="text-text-secondary">
					Choose a new PIN with your account password.
				</p>
				<SetPinForm requirePassword onsaved={() => status.refresh()} />
			</div>
		</details>

		<SecondaryButton onclick={() => (open = false)}>Cancel</SecondaryButton>
	</div>
</dialog>
