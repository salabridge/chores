<script lang="ts">
	import type { MemberOption } from '#lib/chore-creator.js';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import StickyActionBar from '#lib/components/shell/StickyActionBar.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import DoneByLabel from '#lib/components/ui/DoneByLabel.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SegmentedStageProgress from '#lib/components/ui/SegmentedStageProgress.svelte';
	import StageStep from '#lib/components/ui/StageStep.svelte';
	import type { FavourActions } from '#lib/favour-approval.js';
	import {
		ctaLabel,
		doneStageCount,
		introText,
		nextText,
		type PersonalDetail,
		progressDescription,
		progressTitle,
		rewardSummary,
		stageLabel,
		waitingText,
	} from '#lib/personal-detail.js';
	import { completePersonalChore } from '#lib/personal-detail.remote.js';
	import PendingFavourNotice from '../favours/PendingFavourNotice.svelte';
	import DoneBySelect from './DoneBySelect.svelte';
	import FavourBanner from './FavourBanner.svelte';

	interface Props {
		detail: PersonalDetail;
		/** Called after a stage (not the last one) was saved, so the page can reload its data. */
		onstagedone?: () => void | Promise<void>;
		/**
		 * Household members a parent in their own view can name as the doer
		 * (SB-75). Leave out for everyone else.
		 */
		doerOptions?: MemberOption[];
		/**
		 * Approving, declining and asking a parent about a pending favour
		 * (SB-80). Together with `viewer`, it shows the favour's state in
		 * place of the read-only note.
		 */
		favourActions?: FavourActions;
		/** Who is looking, and whether the chore is theirs or they're a parent. */
		viewer?: { id: string; isParent: boolean };
	}

	let { detail, onstagedone, doerOptions, favourActions, viewer }: Props = $props();

	const canAct = $derived(detail.canComplete || detail.canCompleteForAssignee);
	const recording = $derived(Boolean(doerOptions?.length) && canAct);
	// Starts on the assignee, so recording a chore as it stands credits them.
	let chosenDoer = $state<string | null>(null);
	const doneBy = $derived(chosenDoer ?? detail.assigneeId ?? '');

	const staged = $derived(detail.stages.length > 0);
	const currentStage = $derived(detail.stages.find((s) => s.state === 'current'));
	const form = completePersonalChore;
</script>

<div class="flex flex-1 flex-col gap-24 px-24 pb-24">
	<div class="flex flex-col gap-16">
		<div class="flex flex-col gap-8">
			<h2 class="font-display text-[24px] font-bold text-text-primary">{detail.title}</h2>
			<p class="flex items-center gap-6 text-[14px] font-semibold text-text-orange">
				<svg
					class="size-[16px] shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
					/>
				</svg>
				{detail.points} Points Reward
			</p>
			<p class="text-[13px] font-semibold text-text-secondary" data-testid="chore-schedule">
				{detail.schedule}
			</p>
		</div>
		<p class="text-[14px] text-text-secondary">{introText(detail)}</p>
	</div>

	{#if staged}
		<SegmentedStageProgress
			title={progressTitle(detail.title)}
			description={progressDescription(detail)}
			total={detail.stages.length}
			done={doneStageCount(detail)}
		/>

		<ul class="m-0 flex list-none flex-col gap-16 p-0" aria-label="Stages">
			{#each detail.stages as stage, i (stage.id)}
				<StageStep title={stageLabel(i, stage.title)} state={stage.state} />
			{/each}
		</ul>
	{/if}

	{#if detail.canCompleteForAssignee && detail.assigneeName}
		<FavourBanner ownerName={detail.assigneeName} {recording} />
	{/if}

	{#if canAct}
		<Callout tone="info" title="What happens next">{nextText(detail)}</Callout>
	{:else if detail.pendingFavour && favourActions && viewer}
		<PendingFavourNotice
			favour={detail.pendingFavour}
			title={detail.title}
			points={detail.points}
			ownerName={detail.assigneeName}
			viewer={{ ...viewer, isOwner: detail.isAssignee }}
			actions={favourActions}
		/>
	{:else}
		<Callout tone={detail.completedThisPeriod ? 'success' : 'info'} title={detail.completedThisPeriod ? 'Chore complete' : 'Read only'}>
			{waitingText(detail)}
			{#if detail.completedThisPeriod && detail.doneBy}
				<DoneByLabel name={detail.doneBy.name} class="mt-8 flex" />
			{/if}
		</Callout>
	{/if}
</div>

{#if canAct}
	<StickyActionBar>
		{#snippet summary()}{rewardSummary(detail)}{/snippet}
		<!-- A plain form post: it works without JavaScript, and `enhance` makes it
		     in-place when JavaScript is there. It sits inside the bar, because a
		     sticky element only sticks within its parent. -->
		<form
			class="flex flex-col gap-12"
			{...form.enhance(async ({ submit }) => {
				if (await submit()) await onstagedone?.();
			})}
		>
			<input {...form.fields.choreId.as('hidden', detail.choreId)} />
			{#if currentStage}
				<input {...form.fields.stageId.as('hidden', currentStage.id)} />
			{/if}
			{#if recording && doerOptions}
				<DoneBySelect
					{...form.fields.doneBy.as('select')}
					members={doerOptions}
					bind:value={() => doneBy, (v) => (chosenDoer = v)}
				/>
			{/if}
			<FormAlert issues={form.fields.issues()} />
			<PrimaryButton type="submit" pending={form.pending > 0}>{ctaLabel(detail)}</PrimaryButton>
		</form>
	</StickyActionBar>
{/if}
