<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	type Tone = 'orange' | 'blue' | 'neutral';

	interface Props extends Omit<HTMLAnchorAttributes, 'title' | 'href'> {
		href: string;
		title: string;
		description?: string;
		tone?: Tone;
		/** Icon rendered inside the leading white tile (16px). */
		icon?: Snippet;
	}

	let {
		href,
		title,
		description,
		tone = 'neutral',
		icon,
		class: className,
		...rest
	}: Props = $props();

	const tones: Record<Tone, { card: string; title: string; arrow: string }> = {
		orange: {
			card: 'border-2 border-border-orange bg-surface-accent-orange-subtle',
			title: 'text-text-orange',
			arrow: 'bg-accent-orange text-text-default',
		},
		blue: {
			card: 'border-2 border-border-blue bg-surface-accent-blue-subtle',
			title: 'text-text-blue',
			arrow: 'bg-accent-blue text-text-default',
		},
		neutral: {
			card: 'border border-border-subtle bg-surface-accent-base',
			title: 'text-text-primary',
			arrow:
				'border border-border-subtle bg-surface-default text-text-secondary',
		},
	};
	const t = $derived(tones[tone]);
</script>

<a
	{...rest}
	{href}
	data-tone={tone}
	class={[
		'flex items-center gap-12 rounded-[12px] p-16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange',
		t.card,
		className,
	]}
>
	{#if icon}
		<span
			class="flex shrink-0 items-center justify-center rounded-[8px] bg-surface-default p-8"
			aria-hidden="true"
		>
			{@render icon()}
		</span>
	{/if}
	<span class="flex min-w-0 flex-1 flex-col gap-2">
		<span class={['font-display text-[14px] font-semibold', t.title]}
			>{title}</span
		>
		{#if description}
			<span class="text-[12px] text-text-secondary">{description}</span>
		{/if}
	</span>
	<span
		class={[
			'flex size-[28px] shrink-0 items-center justify-center rounded-[14px]',
			t.arrow,
		]}
		aria-hidden="true"
	>
		<!-- biome-ignore lint/a11y/noSvgWithoutTitle: decorative, parent is aria-hidden -->
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M5 12h14M12 5l7 7-7 7" />
		</svg>
	</span>
</a>
