<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import AvatarColorPicker from '#lib/components/ui/AvatarColorPicker.svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { withoutValue } from '#lib/form-field.js';
	import type { HouseholdMember } from '#lib/members.js';
	import { updateMemberAvatar } from '#lib/members.remote.js';

	let {
		member,
		onsaved,
		oncancel,
	}: {
		member: HouseholdMember;
		/** The new colour and initial were saved. */
		onsaved?: () => void;
		oncancel?: () => void;
	} = $props();

	const form = $derived(updateMemberAvatar.for(member.id));
	// svelte-ignore state_referenced_locally
	let color = $state(member.avatarColor ?? 'orange');
	// svelte-ignore state_referenced_locally
	let initial = $state(member.avatarInitial ?? '');
</script>

<form
	{...form.enhance(async (f) => {
		if (await f.submit()) onsaved?.();
	})}
	class="flex flex-col gap-12"
	aria-label={`Change ${member.displayName}'s avatar`}
>
	<input type="hidden" name="id" value={member.id} />
	<FormAlert issues={form.fields.issues()} />
	<div class="flex items-center gap-12">
		<MemberAvatar name={member.displayName} tone={color} {initial} />
		<AvatarColorPicker name="avatarColor" bind:value={color} />
	</div>
	<TextInput
		{...withoutValue(form.fields.avatarInitial.as('text'))}
		label="Avatar initial (optional)"
		hint="One or two letters. Leave blank to use the first letter of the name."
		value={initial}
		oninput={(e) => (initial = e.currentTarget.value)}
		maxlength={2}
		autocomplete="off"
	/>
	<div class="flex gap-8">
		<PrimaryButton type="submit" pending={form.pending > 0}>Save</PrimaryButton>
		<SecondaryButton type="button" variant="tinted" tone="neutral" onclick={oncancel}>
			Cancel
		</SecondaryButton>
	</div>
</form>
