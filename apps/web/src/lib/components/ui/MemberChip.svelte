<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import MemberAvatar from './MemberAvatar.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
		name: string;
		tone?: 'orange' | 'blue' | 'green' | 'amber';
	}

	let { name, tone = 'orange', class: className, ...rest }: Props = $props();
</script>

<span
	{...rest}
	class={[
		'inline-flex w-fit items-center gap-8 rounded-full border border-border-subtle bg-surface-default py-4 pr-12 pl-4 text-[13px] font-semibold whitespace-nowrap text-text-primary',
		className,
	]}
>
	<!-- The name is rendered as text beside the avatar, so hide the avatar's own label. -->
	<MemberAvatar {name} {tone} size="sm" role="presentation" aria-label={undefined} />
	{name}
</span>
