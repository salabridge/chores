<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import StickyActionBar from '#lib/components/shell/StickyActionBar.svelte';
	import Callout from '#lib/components/ui/Callout.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import RotationLoopVisual from '#lib/components/ui/RotationLoopVisual.svelte';
	import StageStep from '#lib/components/ui/StageStep.svelte';
	import {
		advanceText,
		ctaLabel,
		eligibilityText,
		howToText,
		introText,
		loopHeading,
		type RotationDetail,
		waitingText,
	} from '#lib/rotation-detail.js';

	interface Props {
		detail: RotationDetail;
		/** Completes the turn (no stages). Throw an Error with a message to show it. */
		oncomplete: () => Promise<void>;
		/** Checks off one stage; the last one completes the turn. Same error handling. */
		oncompletestage: (stageId: string) => Promise<void>;
	}

	let { detail, oncomplete, oncompletestage }: Props = $props();

	let pending = $state(false);
	let error = $state<string | null>(null);

	const loopId = $props.id();
	const currentStage = $derived(detail.stages.find((s) => s.state === 'current'));

	const waitingTitle = $derived(
		detail.completedThisPeriod
			? 'Turn complete'
			: detail.availableToday
				? 'Whose turn it is'
				: 'Not due today',
	);

	async function submit() {
		pending = true;
		error = null;
		try {
			if (detail.stages.length > 0 && currentStage) {
				await oncompletestage(currentStage.id);
			} else {
				await oncomplete();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong. Try again.';
		} finally {
			pending = false;
		}
	}
</script>

<div class="flex flex-1 flex-col gap-24 px-24 pb-24">
	<!-- Here, not in the action bar: a failed attempt reloads the data, which can
	     unmount the bar (no longer your turn) and would hide the reason. -->
	{#if error}
		<FormAlert issues={[{ message: error }]} />
	{/if}

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
		</div>
		<p class="text-[14px] text-text-secondary">{introText(detail)}</p>
	</div>

	<section aria-labelledby={loopId} class="flex flex-col gap-20">
		<h3 id={loopId} class="font-display text-[15px] font-bold text-text-primary">
			{loopHeading(detail)}
		</h3>
		{#if detail.activeTurn}
			<RotationLoopVisual
				doneLast={detail.doneLast?.name ?? null}
				active={detail.activeTurn.name}
				nextUp={(detail.nextUp ?? detail.activeTurn).name}
			/>
		{:else}
			<Callout tone="warning" title="No one's turn">
				{waitingText(detail)}
			</Callout>
		{/if}
		<Callout tone="info" title="Eligibility Rules">{eligibilityText(detail)}</Callout>
		<Callout tone="success" title="When the rotation advances">{advanceText(detail)}</Callout>
	</section>

	{#if detail.stages.length > 0}
		<section class="flex flex-col gap-12" aria-label="Stages">
			<ul class="m-0 flex list-none flex-col gap-8 p-0">
				{#each detail.stages as stage (stage.id)}
					<StageStep title={stage.title} state={stage.state} />
				{/each}
			</ul>
		</section>
	{/if}

	{#if detail.canComplete}
		<Callout tone="action" title="How to complete this turn">{howToText(detail)}</Callout>
	{:else}
		<Callout tone={detail.completedThisPeriod ? 'success' : 'info'} title={waitingTitle}>
			{waitingText(detail)}
		</Callout>
	{/if}
</div>

{#if detail.canComplete}
	<StickyActionBar>
		<PrimaryButton {pending} onclick={submit}>{ctaLabel(detail)}</PrimaryButton>
	</StickyActionBar>
{/if}
