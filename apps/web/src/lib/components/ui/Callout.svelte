<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Tone = 'info' | 'success' | 'warning' | 'action';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
		/** Colour scheme: info (blue), success (green), warning (amber), action (orange). */
		tone?: Tone;
		/** Bold heading shown next to the icon. Omit for a body-only callout. */
		title?: string;
		/** Replaces the default tone icon. Rendered inside a 16px, tone-coloured slot. */
		icon?: Snippet;
		/** Body content. */
		children?: Snippet;
	}

	let {
		tone = 'info',
		title,
		icon,
		children,
		class: className,
		...rest
	}: Props = $props();

	// Full class strings so Tailwind can see them.
	const toneClasses: Record<Tone, { box: string; accent: string }> = {
		info: {
			box: 'border-border-blue bg-surface-accent-blue-subtle',
			accent: 'text-text-blue',
		},
		success: {
			box: 'border-border-green bg-surface-accent-green-subtle',
			accent: 'text-text-green',
		},
		warning: {
			box: 'border-border-amber bg-surface-accent-amber-subtle',
			accent: 'text-text-amber',
		},
		action: {
			// Figma uses a lighter orange (#fdba74) border here; there is no token for it.
			box: 'border-border-orange/50 bg-surface-accent-orange-subtle',
			accent: 'text-text-orange',
		},
	};

	const styles = $derived(toneClasses[tone]);
</script>

{#snippet defaultIcon()}
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
		{#if tone === 'success'}
			<circle cx="12" cy="12" r="10" />
			<path d="m9 12 2 2 4-4" />
		{:else if tone === 'warning'}
			<path
				d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
			/>
			<path d="M12 9v4" />
			<path d="M12 17h.01" />
		{:else}
			<circle cx="12" cy="12" r="10" />
			<path d="M12 16v-4" />
			<path d="M12 8h.01" />
		{/if}
	</svg>
{/snippet}

<div
	role="note"
	data-tone={tone}
	{...rest}
	class={[
		'flex flex-col gap-8 rounded-xl border p-14 text-left',
		styles.box,
		className,
	]}
>
	{#if title}
		<div class={['flex items-center gap-6', styles.accent]}>
			<span class="size-[16px] shrink-0">
				{#if icon}{@render icon()}{:else}{@render defaultIcon()}{/if}
			</span>
			<p class="min-w-0 flex-1 font-display text-[13px] font-bold">{title}</p>
		</div>
	{/if}
	{#if children}
		<div class="text-[12px] text-text-secondary">
			{@render children()}
		</div>
	{/if}
</div>
