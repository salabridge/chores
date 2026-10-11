<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import ProgressBar from '#lib/components/ui/ProgressBar.svelte';

	interface Props extends HTMLAttributes<HTMLElement> {
		days: number;
		/** The streak length being aimed for. */
		goal: number;
		loopsLeft: number;
		percent: number;
		message: string;
		/** Chores that would extend the streak, linked to their screen. */
		chores?: { id: string; title: string; href: string }[];
	}

	let {
		days,
		goal,
		loopsLeft,
		percent,
		message,
		chores = [],
		class: className,
		...rest
	}: Props = $props();

	const headingId = $props.id();
</script>

<section
	{...rest}
	aria-labelledby={headingId}
	class={[
		'flex flex-col gap-12 rounded-[16px] border border-border-subtle bg-surface-default p-16',
		className,
	]}
>
	<div class="flex items-center justify-between gap-12">
		<div class="flex min-w-0 flex-1 flex-col gap-4">
			<h3
				id={headingId}
				class="font-display text-[15px] font-semibold text-text-primary"
			>
				Keep the streak warm
			</h3>
			<p class="text-[13px] text-text-secondary">{message}</p>
		</div>
		<span
			class="shrink-0 rounded-full bg-surface-accent-amber-subtle px-10 py-6 text-[11px] font-bold text-text-amber"
			>{days} {days === 1 ? 'day' : 'days'}</span
		>
	</div>
	<div class="flex flex-col gap-6">
		<ProgressBar
			value={percent}
			variant="orange"
			aria-label="Streak progress"
		/>
		<div class="flex justify-between text-[12px]">
			<span class="text-text-secondary"
				>{loopsLeft} {loopsLeft === 1 ? 'loop' : 'loops'} left</span
			>
			<span class="font-semibold text-text-primary">{goal}-day streak</span>
		</div>
	</div>
	{#if chores.length > 0}
		<ul
			class="flex flex-wrap gap-8"
			aria-label="Chores that keep the streak going"
		>
			{#each chores as chore (chore.id)}
				<li>
					<a
						href={chore.href}
						class="block rounded-full bg-background-base px-10 py-6 text-[11px] font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange"
						>{chore.title}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
</section>
