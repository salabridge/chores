<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
		/** Member name; the first letter is shown and used as the accessible name. */
		name: string;
		size?: 'sm' | 'md' | 'lg';
		/** Ring colour. */
		tone?: 'orange' | 'blue' | 'green' | 'amber';
		/** Only meaningful for `lg`: Active gets a thick orange ring, Inactive a muted one. */
		active?: boolean;
	}

	let {
		name,
		size = 'md',
		tone = 'orange',
		active = true,
		class: className,
		...rest
	}: Props = $props();

	const initial = $derived(name.trim().charAt(0).toUpperCase());

	const sizes = {
		sm: 'size-[32px] border text-[13px]',
		md: 'size-[40px] border-2 text-[16px]',
		lg: 'size-[56px] text-[22px]',
	} as const;

	const rings = {
		orange:
			'border-border-orange bg-surface-accent-orange-subtle text-text-orange',
		blue: 'border-border-blue bg-surface-accent-blue-subtle text-text-blue',
		green: 'border-border-green bg-surface-accent-green-subtle text-text-green',
		amber: 'border-border-amber bg-surface-accent-amber-subtle text-text-amber',
	} as const;

	const largeState = $derived(
		active
			? 'border-4 border-border-orange bg-surface-accent-orange-subtle text-text-orange'
			: 'border-2 border-border-subtle bg-background-base text-text-secondary opacity-70',
	);
</script>

<span
	role="img"
	aria-label={name}
	{...rest}
	data-size={size}
	data-active={size === 'lg' ? active : undefined}
	class={[
		'inline-flex shrink-0 items-center justify-center rounded-full border-solid font-display font-semibold',
		sizes[size],
		size === 'lg' ? largeState : rings[tone],
		className,
	]}
>
	<span aria-hidden="true">{initial}</span>
</span>
