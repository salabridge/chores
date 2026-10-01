<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
		/** Heading, e.g. "Priority loop first". */
		title: string;
		/** Supporting text. */
		children?: Snippet;
		/** Replaces the default icon inside the tile. */
		icon?: Snippet;
	}

	let { title, children, icon, class: className, ...rest }: Props = $props();
</script>

<div
	role="note"
	{...rest}
	class={[
		'flex items-start gap-12 rounded-2xl border border-border-blue bg-surface-accent-blue-subtle p-16',
		className,
	]}
>
	<span
		class="flex size-[36px] shrink-0 items-center justify-center rounded-[10px] bg-surface-default text-text-blue"
	>
		<span class="size-[18px]">
			{#if icon}
				{@render icon()}
			{:else}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-full"
					aria-hidden="true"
				>
					<path d="m17 2 4 4-4 4" />
					<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
					<path d="m7 22-4-4 4-4" />
					<path d="M21 13v1a4 4 0 0 1-4 4H3" />
				</svg>
			{/if}
		</span>
	</span>
	<div class="min-w-0 flex-1">
		<p class="font-display text-[14px] font-bold text-text-blue">{title}</p>
		{#if children}
			<div class="text-[12px] text-text-secondary">{@render children()}</div>
		{/if}
	</div>
</div>
