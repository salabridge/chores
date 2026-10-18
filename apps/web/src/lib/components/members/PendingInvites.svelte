<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import {
		canManageInvite,
		isExpired,
		type PendingInvite,
	} from '#lib/invites.js';
	import type { HouseholdRole } from '#lib/members.js';
	import {
		resendMemberInvite,
		revokeMemberInvite,
	} from '#lib/members.remote.js';
	import InviteLinkNotice from './InviteLinkNotice.svelte';

	let {
		invites,
		actorRole,
		now = new Date(),
		confirm = (message: string) => window.confirm(message),
		onchanged,
	}: {
		invites: PendingInvite[];
		/** The signed-in parent's role; only owners manage parent invites. */
		actorRole: HouseholdRole;
		/** For expiry; stories pass a fixed time. */
		now?: Date;
		/** Asks before a revoke or a new link; specs pass a stub. */
		confirm?: (message: string) => boolean;
		/** An invite was revoked or resent. */
		onchanged?: () => void;
	} = $props();

	const formatDate = (date: Date) =>
		date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
</script>

{#if invites.length === 0}
	<p class="text-[14px] text-text-secondary">No pending invites.</p>
{:else}
	<ul class="flex flex-col gap-8" aria-label="Pending invites">
		{#each invites as invite (invite.id)}
			{@const expired = isExpired(invite, now)}
			{@const manageable = canManageInvite(actorRole, invite.role)}
			{@const resend = resendMemberInvite.for(invite.id)}
			{@const revoke = revokeMemberInvite.for(invite.id)}
			<li
				class="flex flex-col gap-12 rounded-xl border border-border-subtle bg-surface-default p-12"
			>
				<div class="flex flex-wrap items-center gap-12">
					<div class="min-w-0 flex-1">
						<p
							class="truncate font-display text-[15px] font-semibold text-text-primary"
						>
							{invite.displayName ?? invite.email}
						</p>
						<p class="text-[13px] text-text-secondary">
							{invite.role === 'parent' ? 'Parent' : 'Kid'}{invite.displayName
								? ` · ${invite.email}`
								: ''} ·
							{expired
								? 'Expired'
								: `Expires ${formatDate(invite.expiresAt)}`}
						</p>
					</div>
					{#if manageable}
						<div class="flex items-center gap-8">
							<form
								{...resend.enhance(async (form) => {
									// Renewing an expired invite breaks nothing; a new link does.
									if (
										!expired &&
										!confirm(
											`Make a new link for ${invite.email}? The link you already sent will stop working.`,
										)
									)
										return;
									if (await form.submit()) onchanged?.();
								})}
							>
								<input type="hidden" name="id" value={invite.id} />
								<SecondaryButton
									type="submit"
									variant="tinted"
									tone="neutral"
									aria-label={`Resend invite to ${invite.email}`}
								>
									{expired ? 'Renew' : 'New link'}
								</SecondaryButton>
							</form>
							<form
								{...revoke.enhance(async (form) => {
									if (
										!confirm(
											`Revoke the invite to ${invite.email}? The link they have will stop working.`,
										)
									)
										return;
									if (await form.submit()) onchanged?.();
								})}
							>
								<input type="hidden" name="id" value={invite.id} />
								<SecondaryButton
									type="submit"
									variant="tinted"
									tone="red"
									aria-label={`Revoke invite to ${invite.email}`}
								>
									Revoke
								</SecondaryButton>
							</form>
						</div>
					{/if}
				</div>
				<FormAlert issues={resend.fields.issues() ?? revoke.fields.issues()} />
				{#if resend.result?.link}
					<InviteLinkNotice email={invite.email} link={resend.result.link} />
				{/if}
			</li>
		{/each}
	</ul>
{/if}
