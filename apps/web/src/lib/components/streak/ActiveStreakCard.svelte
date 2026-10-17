<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { nextUp } from '#lib/streak.js';
	import { streakTitle } from '#lib/today.js';

	interface Props extends HTMLAttributes<HTMLElement> {
		days: number;
		exceptions?: number;
		/** The next streak length to aim for. */
		goal: number;
		/** How the household compares, e.g. "Mia is catching up!". */
		note?: string | null;
	}

	let {
		days,
		exceptions = 0,
		goal,
		note = null,
		class: className,
		...rest
	}: Props = $props();

	const next = $derived(nextUp({ days }, goal));
	const headingId = $props.id();
</script>

<section
	{...rest}
	aria-labelledby={headingId}
	class={[
		'flex flex-col gap-12 rounded-[16px] bg-surface-accent-amber-subtle p-16',
		className,
	]}
>
	<div class="flex items-center gap-12">
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="size-[44px] shrink-0 text-text-amber"
			aria-hidden="true"
		>
			<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
		</svg>
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<h2
				id={headingId}
				class="font-display text-[24px] font-bold text-text-primary"
			>
				{streakTitle({ days, exceptions })}
			</h2>
			{#if note}
				<p class="text-[13px] font-semibold text-text-amber">{note}</p>
			{/if}
		</div>
	</div>
	<p class="text-[13px] text-text-secondary">
		Personal chores or shared loops — showing up each day keeps your active
		streak warm.{#if exceptions > 0}
			Includes {exceptions} {exceptions === 1 ? 'exception' : 'exceptions'}.{/if}
	</p>
	<div class="flex items-center justify-between gap-12 text-[12px]">
		<p class="font-bold text-text-amber">{next.label}</p>
		<p class="text-text-secondary">{next.remaining}</p>
	</div>
</section>
