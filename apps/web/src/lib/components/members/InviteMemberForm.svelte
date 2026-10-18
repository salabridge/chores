<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import ChoiceChips from '#lib/components/ui/ChoiceChips.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { latestInviteBirthYear } from '#lib/invites.js';
	import { inviteMember } from '#lib/members.remote.js';
	import { BIRTH_YEAR_PATTERN, MAX_DISPLAY_NAME } from '#lib/setup.js';
	import InviteLinkNotice from './InviteLinkNotice.svelte';

	let {
		canInviteParent,
		currentYear = new Date().getFullYear(),
		oninvited,
	}: {
		/** Only the household owner can invite a parent. */
		canInviteParent: boolean;
		/** For the birth year hint; stories pass a fixed year. */
		currentYear?: number;
		/** An invite was created. */
		oninvited?: () => void;
	} = $props();

	let role = $state<string | number>('kid');
	// The link from the last invite, shown until the next one.
	let sent = $state<{ email: string; link: string } | null>(null);

	const ageHint = $derived(
		`A kid with their own login has to be born in ${latestInviteBirthYear(currentYear)} or earlier. For younger kids, add a managed kid instead.`,
	);

	const options = $derived([
		...(canInviteParent ? [{ value: 'parent', label: 'A parent' }] : []),
		{ value: 'kid', label: 'A kid 13 or older' },
	]);
</script>

<div class="flex flex-col gap-16">
	<form
		{...inviteMember.enhance(async (form) => {
			if (await form.submit()) {
				const result = inviteMember.result;
				if (result) sent = { email: result.email, link: result.link };
				form.element.reset();
				oninvited?.();
			}
		})}
		class="flex flex-col gap-16"
	>
		<FormAlert issues={inviteMember.fields.issues()} />
		<div class="flex flex-col gap-8">
			<span class="text-[14px] font-semibold text-text-secondary">
				Who are you inviting?
			</span>
			<ChoiceChips label="Who are you inviting?" name="role" {options} bind:value={role} />
		</div>
		<TextInput
			{...inviteMember.fields.email.as('email')}
			label="Email"
			autocomplete="off"
			required
		/>
		<TextInput
			{...inviteMember.fields.displayName.as('text')}
			label="Name in this household (optional)"
			maxlength={MAX_DISPLAY_NAME}
			autocomplete="off"
		/>
		{#if role === 'kid'}
			<TextInput
				{...inviteMember.fields.birthYear.as('text')}
				label="Birth year"
				inputmode="numeric"
				pattern={BIRTH_YEAR_PATTERN}
				maxlength={4}
				placeholder={String(latestInviteBirthYear(currentYear))}
				autocomplete="off"
				required
			/>
			<p class="text-[13px] text-text-secondary">{ageHint}</p>
		{/if}
		<PrimaryButton type="submit" pending={inviteMember.pending > 0}>
			Create invite
		</PrimaryButton>
	</form>

	{#if sent}
		<InviteLinkNotice email={sent.email} link={sent.link} />
	{/if}
</div>
