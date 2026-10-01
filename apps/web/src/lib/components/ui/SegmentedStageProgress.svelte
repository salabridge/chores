<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
		/** Heading, e.g. "Room Clean Progress". */
		title: string;
		/** Secondary line, e.g. "Stage 2 of 3 is active right now". */
		description?: string;
		/** Total number of stages (segments). */
		total: number;
		/** Number of completed stages. The next stage is shown as current. */
		done: number;
	}

	let {
		title,
		description,
		total,
		done,
		class: className,
		...rest
	}: Props = $props();

	const count = $derived(Math.max(0, Math.floor(total)));
	const completed = $derived(Math.min(Math.max(0, Math.floor(done)), count));
	const segments = $derived(
		Array.from({ length: count }, (_, i) =>
			i < completed ? 'done' : i === completed ? 'current' : 'pending',
		),
	);

	const segmentClasses = {
		done: 'bg-accent-green',
		current: 'bg-accent-amber',
		pending: 'bg-surface-accent-subtle',
	};
</script>

<div
	{...rest}
	class={[
		'flex flex-col gap-12 rounded-2xl bg-surface-accent-orange-subtle p-16',
		className,
	]}
>
	<div class="flex items-center justify-between gap-12">
		<div class="flex min-w-0 flex-col gap-2">
			<p class="font-display text-[14px] font-bold text-text-primary">
				{title}
			</p>
			{#if description}
				<p class="text-[12px] text-text-secondary">{description}</p>
			{/if}
		</div>
		<span
			class="shrink-0 rounded-full bg-surface-accent-amber-subtle px-8 py-4 text-[11px] font-bold whitespace-nowrap text-text-amber"
		>
			{completed} / {count} done
		</span>
	</div>
	<div
		role="progressbar"
		aria-label={title}
		aria-valuenow={completed}
		aria-valuemin={0}
		aria-valuemax={count}
		aria-valuetext="{completed} of {count} done"
		class="flex gap-8"
	>
		{#each segments as status, i (i)}
			<div
				data-segment={status}
				class={['h-[8px] flex-1 rounded-full', segmentClasses[status]]}
			></div>
		{/each}
	</div>
</div>
