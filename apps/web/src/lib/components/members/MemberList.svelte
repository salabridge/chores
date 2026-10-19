<script lang="ts">
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import {
		canEditMemberAvatar,
		type HouseholdMember,
		type HouseholdRole,
		memberLabel,
	} from '#lib/members.js';
	import EditMemberAvatarForm from './EditMemberAvatarForm.svelte';

	let {
		members,
		actor,
		onchanged,
	}: {
		/** Everyone in the household, already in display order. */
		members: HouseholdMember[];
		/** The signed-in parent. Without one, avatars can't be edited. */
		actor?: { id: string; role: HouseholdRole };
		/** A member's avatar was saved. */
		onchanged?: () => void;
	} = $props();

	let editing = $state<string | null>(null);
</script>

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
