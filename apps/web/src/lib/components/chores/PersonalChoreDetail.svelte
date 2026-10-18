<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import StickyActionBar from '#lib/components/shell/StickyActionBar.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SegmentedStageProgress from '#lib/components/ui/SegmentedStageProgress.svelte';
	import StageStep from '#lib/components/ui/StageStep.svelte';
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

	interface Props {
		detail: PersonalDetail;
		/** Called after a stage (not the last one) was saved, so the page can reload its data. */
		onstagedone?: () => void | Promise<void>;
	}

	let { detail, onstagedone }: Props = $props();

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

	{#if detail.canComplete}
		<Callout tone="info" title="What happens next">{nextText(detail)}</Callout>
	{:else}
		<Callout tone={detail.completedThisPeriod ? 'success' : 'info'} title={detail.completedThisPeriod ? 'Chore complete' : 'Read only'}>
			{waitingText(detail)}
		</Callout>
	{/if}
</div>

{#if detail.canComplete}
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
			<FormAlert issues={form.fields.issues()} />
			<PrimaryButton type="submit" pending={form.pending > 0}>{ctaLabel(detail)}</PrimaryButton>
		</form>
	</StickyActionBar>
{/if}
