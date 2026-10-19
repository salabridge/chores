<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
		/** URL of the (orange) icon image, e.g. an imported SVG. */
		icon: string;
		title: string;
		description: string;
		/** Sample chores or rewards, shown under a "For example" label on desktop. */
		example: string;
	}

	let {
		icon,
		title,
		description,
		example,
		class: className,
		...rest
	}: Props = $props();
</script>

<article
	{...rest}
	class={[
		'flex flex-col gap-12 rounded-[16px] border border-border-subtle bg-surface-default p-[20px] lg:gap-16 lg:p-24',
		className,
	]}
>
	<div class="flex items-center gap-12">
		<span
			class="flex size-[32px] shrink-0 items-center justify-center rounded-[10px] bg-surface-accent-orange-subtle lg:size-[40px]"
		>
			<img src={icon} alt="" width="22" height="22" />
		</span>
		<h3 class="min-w-0 font-display text-[20px] font-semibold text-text-primary">
			{title}
		</h3>
	</div>
	<p class="text-[14px] leading-[1.5] text-text-secondary lg:text-[15px]">
		{description}
	</p>
	<div class="flex flex-col gap-4 lg:border-t lg:border-border-subtle lg:pt-[14px]">
		<p class="hidden text-[11px] font-semibold text-text-secondary lg:block">
			For example
		</p>
		<p class="text-[12px] leading-[1.4] text-text-primary lg:text-[13px]">
			{example}
		</p>
	</div>
</article>
