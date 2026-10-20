<script lang="ts">
	import type { Snippet } from 'svelte';
	import { track } from '#lib/analytics.js';
	import AuthHeading from '#lib/components/auth/AuthHeading.svelte';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import {
		acceptInviteLink,
		leaveHouseholdLink,
		mergeHouseholdLink,
	} from '#lib/invite.remote.js';
	import {
		type CurrentHousehold,
		confirmsHouseholdName,
		type InviteProblem,
		type InviteView,
		mergeDeletesText,
		mergeMovesText,
		PROBLEM_MESSAGES,
	} from '#lib/invite-accept.js';

	let {
		invite,
		token,
		signedInAs,
		problem,
		current = null,
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
		/**
		 * The household they're already in, when `problem` is
		 * `already-in-household`: an owner can move it in, anyone else can leave.
		 */
		current?: CurrentHousehold | null;
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

	function accepted(mergedHousehold: boolean) {
		if (invite.status !== 'open') return;
		track('invite_accepted', {
			role: invite.role,
			merged_household: mergedHousehold,
		});
	}

	const id = $props.id();
	/** What's typed in the merge confirm box. */
	let typed = $state('');
</script>

{#snippet signedIn()}
	<p class="text-[14px] text-text-secondary">
		You're signed in as {signedInAs}.
	</p>
{/snippet}

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
			{@render signedIn()}
		{:else if problem === 'already-in-household' && current?.merge}
			{@const merge = current.merge}
			<Callout tone="warning" title={`You own ${current.name}`}>
				<p>
					To join {invite.householdName}, move {current.name} into it.
					{invite.role === 'parent'
						? "You'll join as a parent."
						: "You'll join as a kid, and so will everyone who comes with you."}
				</p>
			</Callout>

			<section aria-labelledby="{id}-moves" class="flex flex-col gap-8">
				<h2 id="{id}-moves" class="text-[15px] font-semibold text-text-primary">
					What moves
				</h2>
				<ul class="flex flex-col gap-4 text-[14px] text-text-primary">
					{#each merge.members as member}
						<li class="flex justify-between gap-12">
							<span>{member.you ? `${member.displayName} (you)` : member.displayName}</span>
							<span class="text-text-secondary">
								{member.points} {Math.abs(member.points) === 1 ? 'point' : 'points'}
							</span>
						</li>
					{/each}
				</ul>
				<p class="text-[13px] text-text-secondary">
					{mergeMovesText(merge, invite.householdName)}
				</p>
			</section>

			<section aria-labelledby="{id}-deletes" class="flex flex-col gap-8">
				<h2 id="{id}-deletes" class="text-[15px] font-semibold text-text-primary">
					What's deleted
				</h2>
				<p class="text-[14px] text-text-primary">
					{current.name} itself. {mergeDeletesText(merge)} This can't be undone.
				</p>
			</section>

			<form
				{...mergeHouseholdLink.enhance(async (form) => {
					if (await form.submit()) accepted(true);
				})}
				class="flex flex-col gap-16"
			>
				<FormAlert issues={mergeHouseholdLink.fields.issues()} />
				<input {...mergeHouseholdLink.fields.token.as('hidden', token)} />
				<input
					{...mergeHouseholdLink.fields.householdId.as('hidden', current.id)}
				/>
				<TextInput
					{...mergeHouseholdLink.fields.confirmName.as('text')}
					label={`Type ${current.name} to confirm`}
					autocomplete="off"
					oninput={(e) => (typed = e.currentTarget.value)}
				/>
				<SecondaryButton
					type="submit"
					variant="tinted"
					tone="red"
					class="h-[50px] w-full text-[16px]"
					disabled={!confirmsHouseholdName(typed, current.name)}
					pending={mergeHouseholdLink.pending > 0}
				>
					Move {current.name} into {invite.householdName}
				</SecondaryButton>
			</form>
			{@render signedIn()}
			{@render switchAccount?.()}
		{:else if problem === 'already-in-household' && current}
			<Callout tone="info" title={`You're in ${current.name}`}>
				<p>
					Leave it to join {invite.householdName}. Your points and history in
					{current.name} stay behind.
				</p>
			</Callout>
			<form {...leaveHouseholdLink} class="flex flex-col gap-16">
				<FormAlert issues={leaveHouseholdLink.fields.issues()} />
				<input {...leaveHouseholdLink.fields.token.as('hidden', token)} />
				<input
					{...leaveHouseholdLink.fields.householdId.as('hidden', current.id)}
				/>
				<SecondaryButton
					type="submit"
					variant="tinted"
					tone="red"
					class="h-[50px] w-full text-[16px]"
					pending={leaveHouseholdLink.pending > 0}
				>
					Leave {current.name}
				</SecondaryButton>
			</form>
			{@render signedIn()}
			{@render switchAccount?.()}
		{:else if problem}
			<FormAlert issues={[{ message: PROBLEM_MESSAGES[problem] }]} />
			{@render signedIn()}
			{@render switchAccount?.()}
		{:else}
			<form
				{...acceptInviteLink.enhance(async (form) => {
					if (await form.submit()) accepted(false);
				})}
				class="flex flex-col gap-16"
			>
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
