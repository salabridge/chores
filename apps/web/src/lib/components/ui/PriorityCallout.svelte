<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
		/** Heading, e.g. "Priority loop first". */
		title: string;
		/** Supporting text. */
		children?: Snippet;
		/** Replaces the default icon inside the tile. */
		icon?: Snippet;
		/** Makes the whole callout a link, e.g. to the priority chore. */
		href?: string;
		/** The link's call to action, shown from lg; the arrow shows at every width (SB-68). */
		action?: string;
	}

	let {
		title,
		children,
		icon,
		href,
		action = 'Open loop',
		class: className,
		...rest
	}: Props = $props();
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	role={href ? undefined : 'note'}
	{href}
	{...rest}
	class={[
		'flex items-center gap-12 rounded-2xl border border-border-blue bg-surface-accent-blue-subtle p-16',
		href &&
			'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange',
		className,
	]}
>
	<span
		class="flex size-[36px] shrink-0 items-center justify-center rounded-[8px] bg-background-base text-text-blue"
	>
		<span class="size-[22px]">
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
	<span class="flex min-w-0 flex-1 flex-col gap-4">
		<span class="font-display text-[14px] font-semibold text-text-blue">{title}</span>
		{#if children}
			<span class="text-[12px] leading-[1.45] text-text-secondary">{@render children()}</span>
		{/if}
	</span>
	{#if href}
		<span
			class="flex shrink-0 items-center gap-8 text-[12px] font-bold text-text-blue"
			data-slot="action"
			aria-hidden="true"
		>
			<span class="hidden lg:inline">{action}</span>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M5 12h14M12 5l7 7-7 7" />
			</svg>
		</span>
	{/if}
</svelte:element>
