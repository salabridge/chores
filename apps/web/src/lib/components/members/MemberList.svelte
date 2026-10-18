<script lang="ts">
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import { type HouseholdMember, memberLabel } from '#lib/members.js';
	import { AVATAR_COLORS, type AvatarColor } from '#lib/setup.js';

	let {
		members,
	}: {
		/** Everyone in the household, already in display order. */
		members: HouseholdMember[];
	} = $props();

	const tone = (value: string | null): AvatarColor =>
		(AVATAR_COLORS as readonly string[]).includes(String(value))
			? (value as AvatarColor)
			: 'orange';
</script>

<ul class="flex flex-col gap-8" aria-label="Household members">
	{#each members as member (member.id)}
		<li
			class="flex items-center gap-12 rounded-xl border border-border-subtle bg-surface-default p-12"
		>
			<MemberAvatar name={member.displayName} tone={tone(member.avatarColor)} />
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
		</li>
	{/each}
</ul>
