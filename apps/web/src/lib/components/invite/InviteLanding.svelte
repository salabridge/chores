<script lang="ts">
	import type { Snippet } from 'svelte';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { acceptInviteLink } from '#lib/invite.remote.js';
	import {
		type InviteProblem,
		type InviteView,
		PROBLEM_MESSAGES,
	} from '#lib/invite-accept.js';

	let {
		invite,
		token,
		signedInAs,
		problem,
		signUpHref,
		signInHref,
		switchAccount,
		verifyEmail,
	}: {
		invite: InviteView;
		/** The token from the link, posted back to accept it. */
		token: string;
		/** The signed-in user's email, or null when signed out. */
		signedInAs: string | null;
		/** Why the signed-in user can't accept this open invite, if they can't. */
		problem: InviteProblem | null;
		signUpHref: string;
		signInHref: string;
		/** A way to sign out and use another account (the sign-out form). */
		switchAccount?: Snippet;
		/** Sends the signed-in user a code to verify their email (a form). */
		verifyEmail?: Snippet;
	} = $props();

	const invitedText = (open: Extract<InviteView, { status: 'open' }>) =>
		`${open.inviterName ?? 'A parent'} invited you to join ${open.householdName} ${
			open.role === 'parent' ? 'as a parent' : 'with your own login'
		}. The invite is for ${open.email}.`;
</script>

<div class="flex flex-col gap-24">
	{#if invite.status !== 'open'}
		<AuthHeading title="Invite unavailable">
			{PROBLEM_MESSAGES[invite.status]}
		</AuthHeading>
		<PrimaryButton href="/">Go to ChoreLoop</PrimaryButton>
	{:else}
		<AuthHeading title={`Join ${invite.householdName}`}>
			{invitedText(invite)}
		</AuthHeading>

		{#if signedInAs === null}
			<div class="flex flex-col gap-12">
				<PrimaryButton href={signUpHref}>Create an account</PrimaryButton>
				<SecondaryButton href={signInHref}>
					I already have an account
				</SecondaryButton>
			</div>
			<p class="text-[13px] text-text-secondary">
				Use {invite.email}, so the invite can find you.
			</p>
		{:else if problem === 'unverified'}
			<FormAlert issues={[{ message: PROBLEM_MESSAGES.unverified }]} />
			{@render verifyEmail?.()}
			<p class="text-[14px] text-text-secondary">
				You're signed in as {signedInAs}.
			</p>
		{:else if problem}
			<FormAlert issues={[{ message: PROBLEM_MESSAGES[problem] }]} />
			<p class="text-[14px] text-text-secondary">
				You're signed in as {signedInAs}.
			</p>
			{@render switchAccount?.()}
		{:else}
			<form {...acceptInviteLink} class="flex flex-col gap-16">
				<FormAlert issues={acceptInviteLink.fields.issues()} />
				<input {...acceptInviteLink.fields.token.as('hidden', token)} />
				<PrimaryButton type="submit" pending={acceptInviteLink.pending > 0}>
					Join {invite.householdName}
				</PrimaryButton>
			</form>
			<p class="text-[13px] text-text-secondary">
				You're signed in as {signedInAs}.
			</p>
		{/if}
	{/if}
</div>
