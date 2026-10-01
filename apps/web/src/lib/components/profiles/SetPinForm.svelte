<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import PinPad from '#lib/components/ui/PinPad.svelte';
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
	// The PIN pad owns the value (bound below), so drop the one in the spread.
	const pinField = $derived.by(() => {
		const { value: _value, ...rest } = savePin.fields._pin.as('password');
		return rest;
	});
</script>

<form
	{...savePin.enhance(async (form) => {
		const saved = await form.submit();
		pin = '';
		if (saved) {
			form.element.reset();
			onsaved?.();
		}
	})}
	class="flex flex-col gap-16"
>
	<FormAlert issues={savePin.fields.issues()} />
	<PinPad
		{...pinField}
		label="New PIN (4 to 6 digits)"
		bind:value={pin}
	/>
	<TextInput
		{...savePin.fields._confirmPin.as('password')}
		label="Confirm PIN"
		inputmode="numeric"
		autocomplete="off"
	/>
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
