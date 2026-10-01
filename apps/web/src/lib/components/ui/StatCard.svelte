<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		label: string;
		/** Big headline value, e.g. "12 Chores". */
		value: string;
		caption?: string;
		/** Trailing badge next to the label, e.g. "12 active". */
		badge?: Snippet;
	}

	let {
		label,
		value,
		caption,
		badge,
		class: className,
		...rest
	}: Props = $props();
</script>

<div
	{...rest}
	class={[
		'flex min-w-0 flex-col gap-12 rounded-[16px] border border-border-subtle bg-surface-default p-20',
		className,
	]}
>
	<div class="flex items-center justify-between gap-8">
		<p class="text-[13px] text-text-secondary">{label}</p>
		{#if badge}
			<div class="shrink-0">{@render badge()}</div>
		{/if}
	</div>
	<p class="font-display text-[24px] font-bold text-text-primary">{value}</p>
	{#if caption}
		<p class="text-[12px] text-text-secondary">{caption}</p>
	{/if}
</div>
