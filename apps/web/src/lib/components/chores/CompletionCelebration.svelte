<script lang="ts">
	import {
		type CompletionSummary,
		celebrationHeading,
		goalLeftText,
		goalReachedText,
		pointsAwardedText,
		summaryLine,
		summaryTags,
		totalText,
	} from '#lib/chore-completion.js';
	import ConfettiBurst from '#lib/components/ui/ConfettiBurst.svelte';
	import ProgressBar from '#lib/components/ui/ProgressBar.svelte';

	interface Props {
		summary: CompletionSummary;
		/** Where "Back to Today" goes. */
		backHref?: string;
	}

	let { summary, backHref = '/today' }: Props = $props();

	const tags = $derived(summaryTags(summary));
	const tagClasses = {
		shared: 'bg-surface-accent-blue-subtle text-text-blue',
		next: 'bg-surface-accent-green-subtle text-text-green',
	};
</script>

<!-- Full bleed on the orange background; the route hides the tab nav. -->
<div class="flex flex-1 flex-col justify-between bg-background-orange text-text-default">
	<div class="flex flex-col items-center gap-24 p-32">
		<div class="relative size-[140px]">
			<ConfettiBurst />
			<span
				class="absolute top-1/2 left-1/2 flex size-[80px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-amber"
				data-medallion
			>
				<svg
					class="size-[40px]"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M20 6 9 17l-5-5" />
				</svg>
			</span>
		</div>

		<div class="flex w-full flex-col items-center gap-12 text-center">
			<h1 class="font-display text-[28px] font-bold">{celebrationHeading(summary.memberName)}</h1>
			<p class="text-[16px] text-text-ffedd5">{summaryLine(summary)}</p>
		</div>

		<section
			aria-label="Completion summary"
			class="flex w-full flex-col items-center gap-16 rounded-[24px] bg-surface-default p-24"
		>
			<div class="flex w-full flex-col gap-12">
				<div class="flex flex-col gap-4 font-display font-bold">
					<p class="text-[14px] text-text-secondary uppercase">Completed</p>
					<h2 class="text-[20px] text-text-primary">{summary.title}</h2>
				</div>
				{#if tags.length > 0}
					<ul class="m-0 flex list-none flex-wrap gap-8 p-0">
						{#each tags as tag (tag.label)}
							<li
								class={['rounded-full px-10 py-6 text-[11px] leading-none font-bold', tagClasses[tag.tone]]}
							>
								{tag.label}
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="flex w-full flex-col items-center gap-6 text-center">
				<p class="font-display text-[14px] font-bold text-text-secondary uppercase">Points Awarded</p>
				<p class="font-display text-[48px] leading-none font-extrabold text-text-orange">
					{pointsAwardedText(summary.points)}
				</p>
				<p class="text-[13px] text-text-secondary">{totalText(summary.totalPoints)}</p>
			</div>

			<hr class="m-0 w-full border-0 border-t border-border-subtle" />

			<div class="flex w-full flex-col items-center gap-8 text-center">
				<p class="text-[13px] text-text-secondary">Weekly Goal Progress</p>
				<ProgressBar
					class="[&_[role=progressbar]]:h-[10px]!"
					aria-label="Weekly goal progress"
					value={summary.goal.percent}
				/>
				<p class="text-[12px] font-semibold text-text-primary">{goalReachedText(summary.goal)}</p>
				<p class="text-[12px] text-text-secondary">{goalLeftText(summary.goal)}</p>
			</div>
		</section>
	</div>

	<div class="flex flex-col gap-10 p-24">
		<p class="text-center text-[13px] text-text-ffedd5">
			Tap below to close this chore detail and return to Today.
		</p>
		<a
			href={backHref}
			class="flex h-[50px] w-full items-center justify-center rounded-[16px] bg-surface-default font-display text-[16px] font-bold text-text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-default"
		>
			Back to Today
		</a>
	</div>
</div>
