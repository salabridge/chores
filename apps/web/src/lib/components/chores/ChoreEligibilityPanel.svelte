<script lang="ts">
	import {
		type ChoreDraft,
		frequencySummary,
		type MemberOption,
	} from '#lib/chore-creator.js';
	import Callout from '../ui/Callout.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	interface Props {
		/** The chore being created, from the Chore Setup form. */
		draft: ChoreDraft;
		/** Every household member, in household order (the default rotation order). */
		members: MemberOption[];
		/** True once the parent has continued from the setup form. */
		active?: boolean;
	}

	let { draft, members, active = false }: Props = $props();
</script>

<!--
	SB-49 PLUG-IN POINT. This is the right-hand "Eligibility Setup" panel of the
	Chore Creator, shown for Household Rotation chores. It is a placeholder: SB-49
	replaces the body with the member toggle rows, exclusion reasons, shared
	reorder control, and the "Before you continue" summary, and owns the final
	save (chore + stages + rotation members in one transaction).
	`draft` is everything from the setup form; `members` is the default order.
-->
<SurfaceCard
	title="Eligibility Setup"
	subtitle="Confirm who can participate in this chore and keep safety rules attached to the loop."
	class="w-full"
	data-active={active}
	data-testid="eligibility-panel"
>
	<Callout tone="info">
		Household rotations need at least two eligible members.
		{#if draft.kind === 'rotation'}
			{draft.title.trim() || 'This chore'} ({frequencySummary(draft)}) will rotate through {members.length}
			household {members.length === 1 ? 'member' : 'members'} by default.
		{:else}
			This chore is assigned to one person, so there is nothing to set up here.
		{/if}
	</Callout>
</SurfaceCard>
