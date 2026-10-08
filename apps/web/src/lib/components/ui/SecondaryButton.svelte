<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		HTMLAnchorAttributes,
		HTMLButtonAttributes,
	} from 'svelte/elements';

	type BaseProps = {
		children: Snippet;
		/** Disables the button and marks it busy, e.g. while a form is submitting. */
		pending?: boolean;
		/**
		 * `outline` is the default bordered button; `icon` is a square icon-only
		 * button (give it an `aria-label`); `tinted` is a small action button
		 * (Skip, Remind, Reopen, View Loop, Claim) coloured by `tone`.
		 */
		variant?: 'outline' | 'icon' | 'tinted';
		/** Colour of the `tinted` variant. */
		tone?: 'orange' | 'blue' | 'green' | 'amber' | 'neutral';
	};

	type ButtonProps = BaseProps &
		HTMLButtonAttributes & {
			href?: undefined;
		};

	type AnchorProps = BaseProps &
		Omit<HTMLAnchorAttributes, 'children'> & {
			href: string;
		};

	type Props = ButtonProps | AnchorProps;

	let {
		children,
		pending = false,
		variant = 'outline',
		tone = 'orange',
		class: className,
		...rest
	}: Props = $props();

	const tones = {
		orange: 'bg-surface-accent-orange-subtle text-text-orange',
		blue: 'bg-surface-accent-blue-subtle text-text-blue',
		green: 'bg-surface-accent-green-subtle text-text-green',
		amber: 'bg-surface-accent-amber-subtle text-text-amber',
		neutral: 'bg-background-base text-text-secondary',
	} as const;

	const variants = {
		outline:
			'gap-8 rounded-[10px] border border-border-subtle bg-surface-default px-16 py-8 text-[14px] text-text-secondary',
		icon: 'size-[36px] rounded-[10px] border border-border-subtle bg-surface-default text-text-secondary',
		tinted: 'gap-4 rounded-[8px] px-12 py-6 text-[12px]',
	} as const;

	const classes = $derived([
		'inline-flex items-center justify-center font-display font-semibold whitespace-nowrap transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60',
		variants[variant],
		variant === 'tinted' && tones[tone],
		className,
	]);
</script>

{#if rest.href !== undefined}
	{@const { href, ...anchorRest } = rest as Omit<AnchorProps, keyof BaseProps | 'class'>}
	<a
		{...anchorRest}
		{href}
		class={classes}
		aria-busy={pending}
		aria-disabled={pending || undefined}
		tabindex={pending ? -1 : anchorRest.tabindex}
	>
		{@render children()}
	</a>
{:else}
	{@const { type = 'button', ...buttonRest } = rest as Omit<ButtonProps, keyof BaseProps | 'class'>}
	<button
		{...buttonRest}
		{type}
		class={classes}
		disabled={pending || buttonRest.disabled}
		aria-busy={pending}
	>
		{@render children()}
	</button>
{/if}
