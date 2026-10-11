<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import PinInput from '#lib/components/ui/PinInput.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { savePin } from '#lib/profiles.remote.js';

	let {
		requirePassword = false,
		onsaved,
	}: {
		/** Changing an existing PIN needs the account password. */
		requirePassword?: boolean;
		onsaved?: () => void;
	} = $props();

	let pin = $state('');
	let confirmPin = $state('');
	// The PIN inputs own their values (bound below), so drop the spread ones.
	const pinField = $derived.by(() => {
		const { value: _value, ...rest } = savePin.fields._pin.as('password');
		return rest;
	});
	const confirmField = $derived.by(() => {
		const { value: _value, ...rest } = savePin.fields._confirmPin.as('password');
		return rest;
	});
</script>

<form
	{...savePin.enhance(async (form) => {
		const saved = await form.submit();
		pin = '';
		confirmPin = '';
		if (saved) {
			form.element.reset();
			onsaved?.();
		}
	})}
	class="flex flex-col gap-16"
>
	<FormAlert issues={savePin.fields.issues()} />
	<PinInput
		{...pinField}
		label="New PIN (4 to 6 digits)"
		bind:value={pin}
	/>
	<PinInput {...confirmField} label="Confirm PIN" bind:value={confirmPin} />
	{#if requirePassword}
		<TextInput
			{...savePin.fields._password.as('password')}
			label="Account password"
			autocomplete="current-password"
			required
		/>
	{/if}
	<PrimaryButton type="submit" pending={savePin.pending > 0}>Save PIN</PrimaryButton>
</form>
