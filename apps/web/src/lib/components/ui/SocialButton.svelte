<script lang="ts" module>
	export type SocialProvider = 'google' | 'apple';
</script>

<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import apple from '#lib/assets/icons/apple.svg';
	import google from '#lib/assets/icons/google.svg';

	interface Props extends Omit<HTMLButtonAttributes, 'class' | 'children'> {
		provider: SocialProvider;
	}

	const providers = {
		google: { label: 'Google', icon: google },
		apple: { label: 'Apple', icon: apple },
	} satisfies Record<SocialProvider, { label: string; icon: string }>;

	let { provider, type = 'button', ...rest }: Props = $props();

	const { label, icon } = $derived(providers[provider]);
</script>

<button
	{type}
	{...rest}
	class="flex h-[48px] min-w-0 flex-1 items-center justify-center gap-8 rounded-xl border border-border-orange bg-surface-accent-orange-subtle text-[14px] font-semibold text-text-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60"
>
	<img src={icon} alt="" width="18" height="18" />
	<span>{label}</span>
</button>
