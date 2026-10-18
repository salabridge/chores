<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import AvatarColorPicker from '#lib/components/ui/AvatarColorPicker.svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { type AvatarColor, MAX_DISPLAY_NAME } from '#lib/setup.js';
	import { saveParentStep } from '#lib/setup.remote.js';

	let {
		displayName = '',
		avatarColor = 'orange',
		avatarInitial = '',
		onsaved,
		onback,
	}: {
		displayName?: string;
		avatarColor?: AvatarColor;
		avatarInitial?: string | null;
		onsaved?: () => void;
		onback?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let color = $state(avatarColor);
	// svelte-ignore state_referenced_locally
	let typedName = $state(displayName);
</script>

<form
	{...saveParentStep.enhance(async (form) => {
		if (await form.submit()) onsaved?.();
	})}
	class="flex flex-col gap-16"
>
	<FormAlert issues={saveParentStep.fields.issues()} />
	<TextInput
		{...saveParentStep.fields.displayName.as('text')}
		label="What should the kids call you?"
		placeholder="Mom, Dad, ..."
		value={typedName}
		oninput={(e) => (typedName = e.currentTarget.value)}
		maxlength={MAX_DISPLAY_NAME}
		autocomplete="off"
		required
	/>
	<div class="flex flex-col gap-8">
		<span class="text-[14px] font-semibold text-text-secondary">Avatar colour</span>
		<div class="flex items-center gap-16">
			<MemberAvatar name={typedName || 'You'} size="lg" tone={color} />
			<AvatarColorPicker name="avatarColor" bind:value={color} />
		</div>
	</div>
	<TextInput
		{...saveParentStep.fields.avatarInitial.as('text')}
		label="Avatar initial (optional)"
		hint="One or two letters. Leave blank to use the first letter of your name."
		value={avatarInitial ?? ''}
		maxlength={2}
		autocomplete="off"
	/>
	<div class="flex flex-col gap-8">
		<PrimaryButton type="submit" pending={saveParentStep.pending > 0}>
			Continue
		</PrimaryButton>
		{#if onback}
			<SecondaryButton onclick={onback}>Back</SecondaryButton>
		{/if}
	</div>
</form>
