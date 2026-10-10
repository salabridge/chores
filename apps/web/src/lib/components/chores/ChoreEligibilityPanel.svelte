<script lang="ts">
	import { untrack } from 'svelte';
	import {
		type ChoreDraft,
		frequencySummary,
		hasErrors,
		type MemberOption,
		validateDraft,
	} from '#lib/chore-creator.js';
	import {
		type CreateRotationChoreInput,
		defaultRotationMembers,
		eligibilityCallout,
		reviewLines,
		toCreateRotationInput,
	} from '#lib/chore-eligibility.js';
	import {
		excludedMembers,
		inOrder,
		memberTone,
		moveMember,
		problemsFor,
		setEligible,
		setReason,
	} from '#lib/rotation-loops.js';
	import Callout from '../ui/Callout.svelte';
	import MemberAvatar from '../ui/MemberAvatar.svelte';
	import MemberToggleRow from '../ui/MemberToggleRow.svelte';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
	import ReorderButtons from '../ui/ReorderButtons.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';
	import TextInput from '../ui/TextInput.svelte';

	interface Props {
		/** The chore being created, from the Chore Setup form. */
		draft: ChoreDraft;
		/** Every household member, in household order (the default rotation order). */
		members: MemberOption[];
		/** True once the parent has continued from the setup form. */
		active?: boolean;
		/**
		 * Creates the chore, its stages, and the rotation in one go. Reject with
		 * an `Error` to show its message under the button.
		 */
		onsave?: (input: CreateRotationChoreInput) => Promise<void>;
	}

	let { draft, members, active = false, onsave }: Props = $props();

	// Start over only when the household itself changes, not on every setup edit.
	// Writable deriveds: edits override them until `householdKey` changes.
	const householdKey = $derived(JSON.stringify(members));
	let loop = $derived.by(() => {
		householdKey;
		return untrack(() => defaultRotationMembers(members));
	});
	let saving = $state(false);
	let error = $state<string | null>(null);
	// Members whose reason box is open: newly excluded ones, and any "Edit reason" was clicked on.
	let editingReasons = $derived.by((): string[] => {
		householdKey;
		return [];
	});

	const ordered = $derived(inOrder(loop));
	const excluded = $derived(excludedMembers(loop));
	const problems = $derived(problemsFor({ scope: 'whole_household', scopeLabel: null, members: loop }));
	const rotationBlocked = $derived(
		problems.loop.length > 0 || Object.keys(problems.members).length > 0,
	);
	const setupBlocked = $derived(hasErrors(validateDraft(draft)));
	const canSave = $derived(active && !rotationBlocked && !setupBlocked);

	function openReason(memberId: string) {
		if (!editingReasons.includes(memberId)) editingReasons = [...editingReasons, memberId];
	}

	async function save() {
		if (!onsave || !canSave) return;
		saving = true;
		error = null;
		try {
			await onsave(toCreateRotationInput(draft, loop));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save this chore.';
		} finally {
			saving = false;
		}
	}

	const dotTones = {
		green: 'bg-text-green',
		orange: 'bg-text-orange',
		blue: 'bg-text-blue',
	} as const;
</script>

<SurfaceCard
	title="Eligibility Setup"
	subtitle="Confirm who can participate in this chore and keep safety rules attached to the loop."
	class="w-full"
	data-active={active}
	data-testid="eligibility-panel"
>
	{#if draft.kind === 'rotation'}
		<Callout tone="info">{eligibilityCallout(loop)}</Callout>

		<ul class="m-0 flex list-none flex-col gap-12 p-0" aria-label="Rotation members">
			{#each ordered as member, i (member.memberId)}
				<li class="flex flex-col gap-6">
					<MemberToggleRow
						name={member.name}
						bind:checked={
							() => member.eligible,
							(v) => {
								loop = setEligible(loop, member.memberId, v);
								if (!v) openReason(member.memberId);
							}
						}
						reason={member.exclusionReason?.trim() || 'Excluded - add a reason below'}
					>
						{#snippet avatar()}
							<MemberAvatar name={member.name} size="sm" tone={memberTone(member.memberId)} />
						{/snippet}
						{#snippet actions()}
							<ReorderButtons
								name={member.name}
								canMoveUp={i > 0}
								canMoveDown={i < ordered.length - 1}
								onmove={(direction) => (loop = moveMember(loop, member.memberId, direction))}
							/>
						{/snippet}
					</MemberToggleRow>
					{#if !member.eligible && (editingReasons.includes(member.memberId) || problems.members[member.memberId])}
						<TextInput
							label="Reason for excluding {member.name}"
							placeholder="Too young for hot-water handling"
							value={member.exclusionReason ?? ''}
							oninput={(e) => (loop = setReason(loop, member.memberId, e.currentTarget.value))}
							issues={problems.members[member.memberId]
								? [{ message: problems.members[member.memberId] }]
								: undefined}
						/>
					{:else if !member.eligible}
						<button
							type="button"
							class="self-start rounded-sm px-4 text-[12px] font-semibold text-text-orange focus-visible:outline-2 focus-visible:outline-border-orange"
							aria-label="Edit reason for excluding {member.name}"
							onclick={() => openReason(member.memberId)}
						>
							Edit reason
						</button>
					{/if}
				</li>
			{/each}
		</ul>

		{#each excluded.filter((m) => m.exclusionReason?.trim()) as member (member.memberId)}
			<Callout tone="warning" data-testid="exclusion-note">
				{member.name} stays excluded: {member.exclusionReason?.trim()}.
			</Callout>
		{/each}

		{#each problems.loop as message (message)}
			<Callout tone="warning" role="alert">{message}</Callout>
		{/each}

		<section
			aria-labelledby="eligibility-review"
			class="flex flex-col gap-12 rounded-xl bg-surface-accent-base p-16"
		>
			<h3 id="eligibility-review" class="font-display text-[14px] font-bold text-text-primary">
				Before you continue
			</h3>
			<ul class="m-0 flex list-none flex-col gap-12 p-0">
				{#each reviewLines(draft, loop, frequencySummary(draft)) as line (line.text)}
					<li class="flex items-center gap-8 text-[13px] text-text-secondary">
						<span class={['size-[8px] shrink-0 rounded-full', dotTones[line.tone]]} aria-hidden="true"></span>
						{line.text}
					</li>
				{/each}
			</ul>
		</section>

		{#if active && setupBlocked}
			<Callout tone="warning" role="alert">
				The chore setup needs attention. Fix it on the left, then save.
			</Callout>
		{/if}
		{#if error}
			<Callout tone="warning" role="alert" data-testid="save-error">{error}</Callout>
		{/if}

		<div class="flex flex-col gap-8">
			<PrimaryButton type="button" pending={saving} disabled={!canSave} onclick={save}>
				Create Household Rotation
			</PrimaryButton>
			{#if !active}
				<p class="text-[12px] text-text-secondary">
					Continue from the chore setup to save this rotation.
				</p>
			{/if}
		</div>
	{:else}
		<Callout tone="info">
			This chore is assigned to one person, so there is nothing to set up here. Household rotations
			need at least two eligible members.
		</Callout>
	{/if}
</SurfaceCard>
