<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
		title: string;
		subtitle?: string;
		/** Trailing header content, typically a badge. */
		badge?: Snippet;
		children?: Snippet;
	}

	let {
		title,
		subtitle,
		badge,
		children,
		class: className,
		...rest
	}: Props = $props();

	const headingId = $props.id();
</script>

<section
	{...rest}
	aria-labelledby={headingId}
	class={[
		'flex flex-col gap-16 rounded-[16px] border border-border-subtle bg-surface-default p-24',
		className,
	]}
>
	<header class="flex items-center justify-between gap-12">
		<div class="flex min-w-0 flex-col gap-4">
			<h2
				id={headingId}
				class="font-display text-[18px] font-bold text-text-primary"
			>
				{title}
			</h2>
			{#if subtitle}
				<p class="text-[13px] text-text-secondary">{subtitle}</p>
			{/if}
		</div>
		{#if badge}
			<div class="shrink-0">{@render badge()}</div>
		{/if}
	</header>
	{@render children?.()}
</section>
