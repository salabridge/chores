<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
		/** Headline, e.g. "5-Day Active Streak!". */
		title: string;
		/** Optional supporting text, e.g. "Mia is catching up!". */
		children?: Snippet;
		/** Replaces the default flame icon. */
		icon?: Snippet;
	}

	let { title, children, icon, class: className, ...rest }: Props = $props();
</script>

<div
	role="status"
	{...rest}
	class={[
		'flex w-full items-center gap-12 border border-border-amber bg-surface-accent-amber-subtle px-16 py-12 text-text-amber',
		className,
	]}
>
	<span class="size-[22px] shrink-0">
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
				<path
					d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
				/>
			</svg>
		{/if}
	</span>
	<div class="min-w-0 flex-1">
		<p class="font-display text-[14px] font-bold">{title}</p>
		{#if children}
			<p class="text-[12px] text-text-secondary">{@render children()}</p>
		{/if}
	</div>
</div>
