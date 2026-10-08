<script lang="ts">
	import {
		CHORE_FORM_ID,
		type ChoreDraft,
		type ChoreKind,
		emptyStage,
		FREQUENCIES,
		type Frequency,
		frequencyLabel,
		frequencySummary,
		hasErrors,
		MAX_NOTE_LENGTH,
		MAX_TITLE_LENGTH,
		type MemberOption,
		POINT_OPTIONS,
		pointsHint,
		rotationPreviewNote,
		validateDraft,
	} from '#lib/chore-creator.js';
	import { memberTone } from '#lib/rotation-loops.js';
	import Badge from '../ui/Badge.svelte';
	import Callout from '../ui/Callout.svelte';
	import ChoiceChips from '../ui/ChoiceChips.svelte';
	import MemberChip from '../ui/MemberChip.svelte';
	import OptionCard from '../ui/OptionCard.svelte';
	import OptionCardGroup from '../ui/OptionCardGroup.svelte';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import Textarea from '../ui/Textarea.svelte';
	import TextInput from '../ui/TextInput.svelte';
	import StageListEditor from './StageListEditor.svelte';

	interface Props {
		/** The chore being filled in. Bindable, so the page (and the SB-49 panel) can read it. */
		draft: ChoreDraft;
		/** Everyone in the household, in household order. */
		members: MemberOption[];
		/**
		 * Called with a valid draft. Personal chores save here; rotations move on to
		 * Eligibility. Reject with an `Error` to show its message above the buttons.
		 */
		onsubmit: (draft: ChoreDraft) => Promise<void> | void;
		/** Where Cancel goes. */
		cancelHref: string;
		/** Saving or continuing is in flight from outside (e.g. the header button). */
		pending?: boolean;
	}

	let {
		draft = $bindable(),
		members,
		onsubmit,
		cancelHref,
		pending = false,
	}: Props = $props();

	let showErrors = $state(false);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let form = $state<HTMLFormElement>();

	const errors = $derived(validateDraft(draft));
	const shown = $derived(showErrors ? errors : { stage: {} });
	const busy = $derived(submitting || pending);
	const isRotation = $derived(draft.kind === 'rotation');
	const rotationNames = $derived(members.map((m) => m.name));

	const issue = (message: string | undefined) =>
		message ? [{ message }] : undefined;

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		showErrors = true;
		submitError = null;
		if (hasErrors(errors)) {
			// Wait for the messages to render, then jump to the first problem.
			queueMicrotask(() =>
				form
					?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid]')
					?.focus(),
			);
			return;
		}
		submitting = true;
		try {
			await onsubmit(draft);
		} catch (e) {
			submitError =
				e instanceof Error && e.message
					? e.message
					: 'Could not save this chore. Try again.';
		} finally {
			submitting = false;
		}
	}

	function setKind(kind: string) {
		draft.kind = kind as ChoreKind;
	}

	function setUseStages(value: string) {
		draft.useStages = value === 'stages';
		if (draft.useStages && draft.stages.length === 0) {
			draft.stages = [emptyStage()];
		}
	}
</script>

{#snippet userIcon()}
	<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-full" aria-hidden="true">
		<circle cx="8" cy="5" r="2.75" />
		<path d="M2.75 13.5c.5-2.4 2.5-3.75 5.25-3.75s4.75 1.35 5.25 3.75" />
	</svg>
{/snippet}

{#snippet loopIcon()}
	<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-full" aria-hidden="true">
		<path d="M13.5 6.5A5.5 5.5 0 0 0 3.2 5.2M2.5 2.5v2.75h2.75" />
		<path d="M2.5 9.5a5.5 5.5 0 0 0 10.3 1.3M13.5 13.5v-2.75h-2.75" />
	</svg>
{/snippet}

{#snippet arrow()}
	<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[16px] shrink-0 text-text-orange" aria-hidden="true">
		<path d="M3 8h10M9 4l4 4-4 4" />
	</svg>
{/snippet}

{#snippet divider()}
	<hr class="m-0 border-0 border-t border-border-subtle" />
{/snippet}

<form
	id={CHORE_FORM_ID}
	bind:this={form}
	novalidate
	onsubmit={handleSubmit}
	aria-labelledby="chore-setup-heading"
	class="flex min-w-0 flex-col gap-24 rounded-[16px] border border-border-subtle bg-surface-default p-24"
>
	<div class="flex flex-col gap-4">
		<h2 id="chore-setup-heading" class="font-display text-[18px] font-bold text-text-primary">
			Chore Setup
		</h2>
		<p class="text-[13px] text-text-secondary">
			Start with the basics, then decide whether this chore is personal, staged, or part of a
			household rotation.
		</p>
	</div>

	<!-- 1. Define the chore -->
	<section class="flex flex-col gap-12" aria-labelledby="step-define">
		<div class="flex items-center justify-between gap-12">
			<h3 id="step-define" class="font-display text-[16px] font-bold text-text-primary">
				1. Define the chore
			</h3>
			<Badge tone="optional">Required</Badge>
		</div>
		<TextInput
			label="Chore Title"
			placeholder="Run Dishwasher"
			maxlength={MAX_TITLE_LENGTH + 20}
			required
			autocomplete="off"
			value={draft.title}
			oninput={(e) => (draft.title = e.currentTarget.value)}
			aria-invalid={shown.title ? true : undefined}
			issues={issue(shown.title)}
		/>
		<Textarea
			label="Parent Note"
			placeholder="Clear the counters, load the machine, and start the cycle after dinner."
			maxlength={MAX_NOTE_LENGTH + 100}
			bind:value={draft.note}
			issues={issue(shown.note)}
		/>
	</section>

	{@render divider()}

	<!-- 2. Choose chore type -->
	<section class="flex flex-col gap-12" aria-labelledby="step-type">
		<div class="flex items-center justify-between gap-12">
			<h3 id="step-type" class="font-display text-[16px] font-bold text-text-primary">
				2. Choose chore type
			</h3>
			<Badge tone="required">
				{isRotation ? 'Household rotation selected' : 'Personal chore selected'}
			</Badge>
		</div>
		<OptionCardGroup label="Chore type" bind:value={() => draft.kind, setKind}>
			<OptionCard value="personal" label="Personal Chore" icon={userIcon} />
			<OptionCard value="rotation" label="Household Rotation" icon={loopIcon} />
		</OptionCardGroup>
		<Callout tone="info">
			<span class="text-text-blue">
				Personal chores belong to one child. Household rotations share the work across eligible
				family members in a repeating loop.
			</span>
		</Callout>
	</section>

	{@render divider()}

	<!-- 3. Stages -->
	<section class="flex flex-col gap-12" aria-labelledby="step-stages">
		<div class="flex items-center justify-between gap-12">
			<h3 id="step-stages" class="font-display text-[16px] font-bold text-text-primary">
				3. Add stages if needed
			</h3>
			<Badge tone="this-week">Optional</Badge>
		</div>
		<OptionCardGroup
			label="Stages"
			bind:value={() => (draft.useStages ? 'stages' : 'single'), setUseStages}
		>
			<OptionCard value="stages" label="Use Stages" icon={loopIcon} />
			<OptionCard value="single" label="Single Step" />
		</OptionCardGroup>
		{#if draft.useStages}
			<StageListEditor
				bind:stages={draft.stages}
				errors={shown.stage}
				listError={shown.stages}
			/>
		{/if}
	</section>

	{@render divider()}

	<!-- 4. Frequency and points -->
	<section class="flex flex-col gap-12" aria-labelledby="step-frequency">
		<div class="flex items-center justify-between gap-12">
			<h3 id="step-frequency" class="font-display text-[16px] font-bold text-text-primary">
				4. Choose frequency and points
			</h3>
			<Badge tone="earned">{frequencySummary(draft)}</Badge>
		</div>
		<div class="flex flex-col gap-8">
			<span class="text-[13px] font-semibold text-text-primary">Frequency</span>
			<ChoiceChips
				label="Frequency"
				options={FREQUENCIES.map((value) => ({ value, label: frequencyLabel(value) }))}
				bind:value={() => draft.frequency, (v) => (draft.frequency = v as Frequency)}
			/>
		</div>
		<div class="flex flex-col gap-8">
			<span class="text-[13px] font-semibold text-text-primary">Reward Points</span>
			<ChoiceChips
				label="Reward Points"
				options={POINT_OPTIONS.map((value) => ({ value }))}
				bind:value={() => draft.points, (v) => (draft.points = Number(v))}
			/>
			{#if shown.points}
				<p class="text-[13px] text-text-amber" role="alert">{shown.points}</p>
			{/if}
		</div>
		<div class="flex items-start gap-8 rounded-[12px] bg-surface-accent-base p-12 text-[13px] text-text-secondary">
			<span class="mt-[2px]" aria-hidden="true">ⓘ</span>
			<p class="min-w-0 flex-1">{pointsHint(draft)}</p>
		</div>
	</section>

	{@render divider()}

	<!-- 5. Assignee -->
	<section class="flex flex-col gap-12" aria-labelledby="step-assignee">
		<div class="flex items-center justify-between gap-12">
			<h3 id="step-assignee" class="font-display text-[16px] font-bold text-text-primary">
				5. Select assignee
			</h3>
			<Badge tone="reachable">{isRotation ? 'Rotation chosen' : 'Individual chosen'}</Badge>
		</div>
		<OptionCardGroup label="Assignee type" accent="blue" bind:value={() => draft.kind, setKind}>
			<OptionCard value="personal" label="Assign Individual" icon={userIcon} />
			<OptionCard value="rotation" label="Household Rotation" icon={loopIcon} />
		</OptionCardGroup>

		{#if isRotation}
			<div class="flex flex-col gap-12 rounded-[12px] bg-surface-accent-base p-16" data-testid="rotation-preview">
				<div class="flex items-center justify-between gap-12">
					<h4 class="font-display text-[14px] font-semibold text-text-primary">Rotation Preview</h4>
					{#if rotationNames.length > 0}
						<span class="rounded-[8px] bg-surface-default px-8 py-4 text-[11px] font-semibold text-text-secondary">
							{rotationNames.join(' → ')}
						</span>
					{/if}
				</div>
				<ol class="m-0 flex list-none flex-wrap items-center gap-8 p-0">
					{#each members as member, i (member.id)}
						<li class="inline-flex items-center gap-8">
							{#if i > 0}{@render arrow()}{/if}
							<MemberChip name={member.name} tone={memberTone(member.id)} />
						</li>
					{/each}
					<li class="inline-flex items-center gap-8">
						{#if members.length > 0}{@render arrow()}{/if}
						<Badge tone="earned">Loop Reset</Badge>
					</li>
				</ol>
				<p class="text-[13px] text-text-secondary">{rotationPreviewNote}</p>
			</div>
		{:else}
			<div class="flex flex-col gap-8">
				<ChoiceChips
					label="Assign to"
					options={members.map((m) => ({ value: m.id, label: m.name }))}
					bind:value={() => draft.assigneeId ?? undefined, (v) => (draft.assigneeId = String(v))}
				/>
				{#if shown.assignee}
					<p class="text-[13px] text-text-amber" role="alert">{shown.assignee}</p>
				{/if}
			</div>
		{/if}
	</section>

	{#if submitError}
		<Callout tone="warning" title="Could not continue" role="alert">{submitError}</Callout>
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-16">
		<p class="max-w-[280px] text-[13px] text-text-secondary">
			You can still change frequency, points, and stages after the loop is created.
		</p>
		<div class="flex items-center gap-12">
			<SecondaryButton href={cancelHref}>Cancel</SecondaryButton>
			<div class="w-[220px]">
				<PrimaryButton type="submit" pending={busy}>
					{isRotation ? 'Continue to Eligibility' : 'Create Chore'}
				</PrimaryButton>
			</div>
		</div>
	</div>
</form>
