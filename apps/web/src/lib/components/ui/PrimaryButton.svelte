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
		 * `lg` is the full-width 50px form CTA. `sm` is the compact auto-width
		 * button for page headers and toolbars, sized to sit beside SecondaryButton.
		 */
		size?: 'lg' | 'sm';
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
		size = 'lg',
		class: className,
		...rest
	}: Props = $props();

	const sizes = {
		lg: 'flex h-[50px] w-full rounded-[14px] text-[16px] font-semibold',
		sm: 'inline-flex h-[36px] gap-8 rounded-[10px] px-16 font-display text-[14px] font-semibold whitespace-nowrap',
	} as const;

	const classes = $derived([
		'items-center justify-center bg-accent-orange text-text-default transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60',
		sizes[size],
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
