<script lang="ts">
	import { pointsAwardedText } from '#lib/chore-completion.js';
	import ConfettiBurst from '#lib/components/ui/ConfettiBurst.svelte';
	import {
		type GiftItem,
		giftMomentLine,
		giftMomentSummary,
		giftMomentTotal,
	} from '#lib/gift.js';

	let {
		gifts,
		ondismiss,
		pending = false,
	}: {
		/** The kid's unseen gifts, newest first (SB-83). Several share one moment. */
		gifts: GiftItem[];
		/**
		 * The kid closed it ("Awesome!" or Escape). That's when the gifts are
		 * marked seen, not when it renders, so a missed render doesn't use it up.
		 */
		ondismiss: () => void;
		/** Marking them seen is in flight. */
		pending?: boolean;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	const total = $derived(giftMomentTotal(gifts));
	const summary = $derived(giftMomentSummary(gifts));

	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
	});

	function dismiss() {
		if (!pending) ondismiss();
	}
</script>

<!--
	The completion celebration's look (orange, confetti around an amber
	medallion, a white summary card), as a modal over whatever screen the kid
	opened. ConfettiBurst keeps still for reduced motion; nothing else moves.
-->
<dialog
	bind:this={dialog}
	aria-labelledby="gift-moment-title"
	oncancel={(event) => {
		// Escape closes it the same way as the button, through the parent.
		event.preventDefault();
		dismiss();
	}}
	class="m-auto max-h-[calc(100dvh-32px)] w-[min(370px,calc(100vw-32px))] overflow-y-auto rounded-[24px] border-0 bg-background-orange p-0 text-text-default backdrop:bg-black/50"
>
	<div class="flex flex-col items-center gap-20 p-24">
		<div class="relative size-[140px]">
			<ConfettiBurst />
			<span
				class="absolute top-1/2 left-1/2 flex size-[80px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-amber"
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
					<rect x="3" y="8" width="18" height="4" rx="1" />
					<path d="M12 8v13" />
					<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
					<path
						d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"
					/>
				</svg>
			</span>
		</div>

		<div class="flex flex-col items-center gap-8 text-center">
			<h2 id="gift-moment-title" class="font-display text-[28px] font-bold">
				You got bonus points!
			</h2>
			{#if summary}
				<p class="text-[16px] text-text-ffedd5">{summary}</p>
			{/if}
		</div>

		<section
			aria-label="Bonus points"
			class="flex w-full flex-col items-center gap-16 rounded-[24px] bg-surface-default p-24"
		>
			<p
				class="font-display text-[48px] leading-none font-extrabold text-text-orange"
				data-testid="gift-total"
			>
				{pointsAwardedText(total)}
			</p>
			<ul class="m-0 flex w-full list-none flex-col gap-8 p-0 text-center">
				{#each gifts as gift (gift.id)}
					<li class="text-[14px] font-semibold text-text-primary">
						{giftMomentLine(gift)}
					</li>
				{/each}
			</ul>
			<p class="text-center text-[12px] text-text-secondary">
				They count toward your balance, not your weekly goal.
			</p>
		</section>

		<button
			type="button"
			onclick={dismiss}
			disabled={pending}
			class="flex h-[50px] w-full items-center justify-center rounded-[16px] bg-surface-default font-display text-[16px] font-bold text-text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-default disabled:opacity-70"
		>
			Awesome!
		</button>
	</div>
</dialog>
