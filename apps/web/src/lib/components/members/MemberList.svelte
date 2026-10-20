<script lang="ts">
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import {
		canEditMemberAvatar,
		canRemoveMember,
		type HouseholdMember,
		type HouseholdRole,
		memberLabel,
		pointsMoveTargets,
	} from '#lib/members.js';
	import EditMemberAvatarForm from './EditMemberAvatarForm.svelte';
	import GiftPointsForm from './GiftPointsForm.svelte';
	import RemoveMemberDialog from './RemoveMemberDialog.svelte';

	let {
		members,
		actor,
		onchanged,
		ongifted,
		onremoved,
	}: {
		/** Everyone in the household, already in display order. */
		members: HouseholdMember[];
		/** The signed-in parent. Without one, avatars can't be edited. */
		actor?: { id: string; role: HouseholdRole };
		/** A member's avatar was saved. */
		onchanged?: () => void;
		/** Bonus points were given to a kid. */
		ongifted?: (memberId: string, points: number) => void;
		/** A member was removed from the household (SB-84). */
		onremoved?: (memberId: string) => void;
	} = $props();

	let editing = $state<string | null>(null);
	let gifting = $state<string | null>(null);
	/** The last gift, for the confirmation under that kid's name. */
	let gifted = $state<{ id: string; points: number } | null>(null);
	/** The member the remove dialog is open for. */
	let removing = $state<HouseholdMember | null>(null);
	let removeOpen = $state(false);
	/** The last removal, confirmed above the list (the member has left it). */
	let removed = $state<{ name: string; movedTo: string | null } | null>(null);
</script>

{#if removed}
	<p role="status" class="mb-8 text-[13px] text-text-green">
		Removed {removed.name} from the household.{removed.movedTo
			? ` Their points moved to ${removed.movedTo}.`
			: ''}
	</p>
{/if}

<ul class="flex flex-col gap-8" aria-label="Household members">
	{#each members as member (member.id)}
		<li
			class="flex flex-col gap-12 rounded-xl border border-border-subtle bg-surface-default p-12"
		>
			<div class="flex items-center gap-12">
				<MemberAvatar
					name={member.displayName}
					tone={member.avatarColor}
					initial={member.avatarInitial}
				/>
				<div class="min-w-0 flex-1">
					<p class="truncate font-display text-[15px] font-semibold text-text-primary">
						{member.displayName}
					</p>
					<p class="text-[13px] text-text-secondary">
						{memberLabel(member)}{member.birthYear
							? `, born ${member.birthYear}`
							: ''}
					</p>
				</div>
				<div class="flex shrink-0 flex-wrap justify-end gap-8">
					{#if actor && member.role === 'kid' && gifting !== member.id}
						<SecondaryButton
							type="button"
							variant="tinted"
							tone="orange"
							aria-label={`Give ${member.displayName} bonus points`}
							onclick={() => {
								gifting = member.id;
								gifted = null;
							}}
						>
							Give bonus points
						</SecondaryButton>
					{/if}
					{#if actor && canRemoveMember(actor, member)}
						<SecondaryButton
							type="button"
							variant="tinted"
							tone="red"
							aria-label={`Remove ${member.displayName} from the household`}
							onclick={() => {
								removing = member;
								removeOpen = true;
							}}
						>
							Remove
						</SecondaryButton>
					{/if}
					{#if actor && canEditMemberAvatar(actor, member) && editing !== member.id}
						<SecondaryButton
							type="button"
							variant="tinted"
							tone="neutral"
							aria-label={`Edit ${member.displayName}'s avatar`}
							onclick={() => (editing = member.id)}
						>
							Edit avatar
						</SecondaryButton>
					{/if}
				</div>
			</div>
			{#if gifted?.id === member.id}
				<p role="status" class="text-[13px] text-text-green">
					Gave {member.displayName} {gifted.points} bonus {gifted.points === 1 ? 'point' : 'points'}.
				</p>
			{/if}
			{#if gifting === member.id}
				<GiftPointsForm
					{member}
					oncancel={() => (gifting = null)}
					onsaved={(points) => {
						gifting = null;
						gifted = { id: member.id, points };
						ongifted?.(member.id, points);
					}}
				/>
			{/if}
			{#if editing === member.id}
				<EditMemberAvatarForm
					{member}
					oncancel={() => (editing = null)}
					onsaved={() => {
						editing = null;
						onchanged?.();
					}}
				/>
			{/if}
		</li>
	{/each}
</ul>

{#if removing}
	{@const target = removing}
	<RemoveMemberDialog
		bind:open={removeOpen}
		member={target}
		moveTargets={pointsMoveTargets(members, target)}
		onremoved={(movedTo) => {
			removed = { name: target.displayName, movedTo };
			onremoved?.(target.id);
		}}
	/>
{/if}
