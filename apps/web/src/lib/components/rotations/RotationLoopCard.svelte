<script lang="ts">
	import { untrack } from 'svelte';
	import {
		countsLabel,
		draftOf,
		eligibleMembers,
		inOrder,
		isDirty,
		MAX_SCOPE_LABEL_LENGTH,
		memberTone,
		moveMember,
		orderExplanation,
		problemsFor,
		type RotationLoop,
		type RotationScope,
		type SaveLoopInput,
		scopeExplanation,
		setEligible,
		setReason,
		toSaveInput,
	} from '#lib/rotation-loops.js';
	import Callout from '../ui/Callout.svelte';
	import MemberAvatar from '../ui/MemberAvatar.svelte';
	import MemberToggleRow from '../ui/MemberToggleRow.svelte';
	import OptionCard from '../ui/OptionCard.svelte';
	import OptionCardGroup from '../ui/OptionCardGroup.svelte';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
	import ReorderButtons from '../ui/ReorderButtons.svelte';
	import RotationOrderPreview from '../ui/RotationOrderPreview.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import TextInput from '../ui/TextInput.svelte';

	interface Props {
		loop: RotationLoop;
		/** Where Edit Loop goes (the Chore Creator in edit mode). */
		editHref: string;
		/** Saves the draft. Reject with an `Error` to show its message on the card. */
		onsave: (input: SaveLoopInput) => Promise<void>;
		/** Hands the turn back to the first eligible member. Same error handling. */
		onreset: (choreId: string) => Promise<void>;
	}

	let { loop, editHref, onsave, onreset }: Props = $props();

	let draft = $state(untrack(() => draftOf(loop)));
	let saving = $state(false);
	let resetting = $state(false);
	let confirmingReset = $state(false);
	let error = $state<string | null>(null);
	// Members whose reason box is open: newly excluded ones, and any "Edit reason" was clicked on.
	let editingReasons = $state<string[]>([]);

	// Start over from what's saved when the saved loop changes (after a save or
	// a reload), but not when something else on the page reloads the same data.
	const savedKey = $derived(JSON.stringify(loop));
	$effect(() => {
		savedKey;
		untrack(() => {
			draft = draftOf(loop);
			editingReasons = [];
		});
	});

	const headingId = $props.id();
	const ordered = $derived(inOrder(draft.members));
	const dirty = $derived(isDirty(loop, draft));
	const problems = $derived(problemsFor(draft));
	const blocked = $derived(
		problems.loop.length > 0 || Object.keys(problems.members).length > 0,
	);
	const activeName = $derived(
		loop.members.find((m) => m.memberId === loop.currentMemberId)?.name ?? null,
	);
	const firstName = $derived(eligibleMembers(loop.members)[0]?.name ?? null);
	// The reset target is what's saved, not the unsaved draft.
	const canReset = $derived(eligibleMembers(loop.members).length > 0);

	async function save() {
		saving = true;
		error = null;
		try {
			await onsave(toSaveInput(loop.choreId, draft));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save this loop.';
		} finally {
			saving = false;
		}
	}

	async function reset() {
		resetting = true;
		error = null;
		try {
			await onreset(loop.choreId);
			confirmingReset = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not reset this loop.';
		} finally {
			resetting = false;
		}
	}

	function discard() {
		draft = draftOf(loop);
		editingReasons = [];
		error = null;
	}

	function openReason(memberId: string) {
		if (!editingReasons.includes(memberId)) editingReasons.push(memberId);
	}
</script>

<section
	aria-labelledby={headingId}
	data-chore-id={loop.choreId}
	class="flex flex-col gap-20 rounded-[16px] border border-border-subtle bg-surface-default p-24"
>
	<header class="flex items-start justify-between gap-12 border-b border-border-subtle pb-16">
		<div class="flex min-w-0 flex-col gap-4">
			<h2 id={headingId} class="font-display text-[18px] font-bold text-text-primary">
				{loop.title}
			</h2>
			{#if loop.description}
				<p class="text-[13px] text-text-secondary">{loop.description}</p>
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-8">
			<SecondaryButton href={editHref}>Edit Loop</SecondaryButton>
			<SecondaryButton
				variant="icon"
				aria-label="Reset {loop.title} to its first eligible member"
				disabled={!canReset}
				onclick={() => (confirmingReset = true)}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[16px]" aria-hidden="true">
					<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
					<path d="M21 3v5h-5" />
					<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
					<path d="M8 16H3v5" />
				</svg>
			</SecondaryButton>
		</div>
	</header>

	{#if confirmingReset}
		<Callout tone="warning" title="Reset this loop?" data-testid="reset-confirm">
			<p>
				The turn goes back to {firstName ?? 'the first eligible member'}{activeName && activeName !== firstName
					? `, instead of ${activeName}`
					: ''}. Done Last and points don't change.
			</p>
			<div class="mt-8 flex items-center gap-8">
				<SecondaryButton variant="tinted" tone="amber" pending={resetting} onclick={reset}>
					Reset turn
				</SecondaryButton>
				<SecondaryButton variant="tinted" tone="blue" disabled={resetting} onclick={() => (confirmingReset = false)}>
					Cancel
				</SecondaryButton>
			</div>
		</Callout>
	{/if}

	<div class="grid gap-16 md:grid-cols-[1.1fr_1fr_1fr]">
		<div class="flex min-w-0 flex-col gap-8 rounded-[16px] bg-background-base p-16">
			<h3 class="font-display text-[13px] font-semibold text-text-secondary">Rotation Scope</h3>
			<OptionCardGroup
				label="Rotation scope"
				bind:value={() => draft.scope, (v) => (draft.scope = v as RotationScope)}
				class="flex-wrap gap-8"
			>
				<OptionCard value="whole_household" label="Whole Household" />
				<OptionCard value="eligible_subset" label="Eligible Subset" />
			</OptionCardGroup>
			{#if draft.scope === 'eligible_subset'}
				<TextInput
					label="Scope label"
					placeholder="Kids only"
					maxlength={MAX_SCOPE_LABEL_LENGTH}
					value={draft.scopeLabel ?? ''}
					oninput={(e) => (draft.scopeLabel = e.currentTarget.value)}
				/>
			{/if}
			<p class="text-[12px] text-text-secondary">{scopeExplanation(draft.scope, draft.members)}</p>
		</div>
		<div class="flex min-w-0 flex-col gap-8 rounded-[16px] bg-background-base p-16">
			<h3 class="font-display text-[13px] font-semibold text-text-secondary">Reward</h3>
			<p class="font-display text-[18px] font-bold text-text-primary">{loop.points} Points</p>
			<p class="text-[12px] text-text-secondary">
				Awarded when the current turn is completed and the chore is marked done.
			</p>
		</div>
		<div class="flex min-w-0 flex-col gap-8 rounded-[16px] bg-background-base p-16">
			<h3 class="font-display text-[13px] font-semibold text-text-secondary">Advance Rule</h3>
			<p class="font-display text-[18px] font-bold text-text-primary">After completion</p>
			<p class="text-[12px] text-text-secondary">
				The loop advances immediately after the current member finishes and claims the turn.
			</p>
		</div>
	</div>

	<div class="flex flex-col gap-12">
		<div class="flex items-center justify-between gap-12">
			<h3 class="font-display text-[14px] font-semibold text-text-primary">Member Rules</h3>
			<span class="rounded-full bg-surface-accent-orange-subtle px-8 py-4 text-[11px] font-semibold text-text-orange">
				{countsLabel(draft.members)}
			</span>
		</div>
		<ul class="m-0 flex list-none flex-col gap-8 p-0">
			{#each ordered as member, i (member.memberId)}
				<li class="flex flex-col gap-6">
					<MemberToggleRow
						name={member.name}
						bind:checked={
							() => member.eligible,
							(v) => {
								draft.members = setEligible(draft.members, member.memberId, v);
								if (!v) openReason(member.memberId);
							}
						}
						reason={member.exclusionReason?.trim()
							? `Excluded - ${member.exclusionReason.trim()}`
							: 'Excluded - add a reason below'}
					>
						{#snippet avatar()}
							<MemberAvatar name={member.name} tone={memberTone(member.memberId)} />
						{/snippet}
						{#snippet actions()}
							<ReorderButtons
								name={member.name}
								canMoveUp={i > 0}
								canMoveDown={i < ordered.length - 1}
								onmove={(direction) =>
									(draft.members = moveMember(draft.members, member.memberId, direction))}
							/>
						{/snippet}
					</MemberToggleRow>
					{#if !member.eligible && !editingReasons.includes(member.memberId)}
						<button
							type="button"
							class="self-start rounded-sm px-4 text-[12px] font-semibold text-text-orange focus-visible:outline-2 focus-visible:outline-border-orange"
							aria-label="Edit reason for excluding {member.name}"
							onclick={() => openReason(member.memberId)}
						>
							Edit reason
						</button>
					{:else if !member.eligible}
						<TextInput
							label="Reason for excluding {member.name}"
							placeholder="Too young for hot-water handling"
							value={member.exclusionReason ?? ''}
							oninput={(e) =>
								(draft.members = setReason(draft.members, member.memberId, e.currentTarget.value))}
							issues={problems.members[member.memberId]
								? [{ message: problems.members[member.memberId] }]
								: undefined}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<div class="flex flex-col gap-12 rounded-[16px] bg-background-base p-16">
		<h3 class="font-display text-[14px] font-semibold text-text-primary">Assignment Order Preview</h3>
		<RotationOrderPreview
			showSummary
			members={eligibleMembers(draft.members).map((m) => ({
				name: m.name,
				tone: memberTone(m.memberId),
			}))}
		/>
		<p class="text-[12px] text-text-secondary">{orderExplanation(draft.members)}</p>
	</div>

	<Callout tone="success">
		The rotation advances immediately after the current member completes the chore and claims the
		reward. The next eligible member in the loop becomes active right away.
	</Callout>

	{#each problems.loop as message (message)}
		<Callout tone="warning" role="alert">{message}</Callout>
	{/each}
	{#if error}
		<Callout tone="warning" role="alert" data-testid="save-error">{error}</Callout>
	{/if}

	{#if dirty}
		<div class="flex items-center justify-end gap-12">
			<SecondaryButton disabled={saving} onclick={discard}>Discard changes</SecondaryButton>
			<PrimaryButton pending={saving} disabled={blocked} onclick={save}>Save loop</PrimaryButton>
		</div>
	{/if}
</section>
