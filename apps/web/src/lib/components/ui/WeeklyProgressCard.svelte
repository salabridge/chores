<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import ProgressBar from './ProgressBar.svelte';

	interface Props extends HTMLAttributes<HTMLElement> {
		/** The week's dates, e.g. "Oct 5–11". */
		label: string;
		/** ISO week number. */
		number: number;
		done: number;
		due: number;
		/** Points earned this week. */
		points: number;
	}

	let {
		label,
		number,
		done,
		due,
		points,
		class: className,
		...rest
	}: Props = $props();

	const headingId = $props.id();
	const percent = $derived(due > 0 ? Math.round((done / due) * 100) : 0);
</script>

<section
	{...rest}
	aria-labelledby={headingId}
	class={[
		'flex flex-col gap-16 rounded-[16px] border border-border-subtle bg-surface-default p-16',
		className,
	]}
>
	<div class="flex items-center justify-between gap-12">
		<div class="flex min-w-0 flex-col gap-2">
			<h2 id={headingId} class="font-display text-[16px] font-semibold text-text-primary">
				Weekly Progress
			</h2>
			<p class="text-[11px] text-text-secondary">{label}</p>
		</div>
		<p class="shrink-0 text-[11px] font-bold text-text-orange">Week {number}</p>
	</div>

	<div class="flex items-end gap-20">
		<div class="flex min-w-0 flex-1 flex-col gap-8">
			<div class="flex justify-between gap-8 text-[11px]">
				<p class="font-semibold text-text-orange">{done} of {due} completed</p>
				<p class="text-text-secondary">{percent}%</p>
			</div>
			<ProgressBar
				value={done}
				max={Math.max(due, 1)}
				variant="orange"
				aria-label="Chores completed this week"
			/>
		</div>
		<div class="flex shrink-0 flex-col items-end gap-2">
			<p class="text-[10px] text-text-secondary">Earned this week</p>
			<p class="font-display text-[22px] font-semibold text-text-orange">
				{points} pts
			</p>
		</div>
	</div>
</section>
