<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import PointsPill from '#lib/components/ui/PointsPill.svelte';
	import type { AvatarColor } from '#lib/setup.js';
	import TabIcon from './TabIcon.svelte';
	import { isTabActive, tabsFor } from './tabs.ts';

	interface Props extends HTMLAttributes<HTMLElement> {
		pathname: string;
		/** The acting member; without one (no household yet) only the nav shows. */
		member?: { name: string; points: number; tone?: AvatarColor } | null;
		/** A parent acting as themselves also gets the Overview and Account tabs. */
		parent?: boolean;
	}

	let {
		pathname,
		member = null,
		parent = false,
		class: className,
		...rest
	}: Props = $props();
</script>

<!--
	Desktop member header (SB-68): the phone screens' greeting and points pill,
	plus the tabs the phone shows in BottomNav. The shell decides when it shows.
-->
<header
	{...rest}
	class={[
		'grid h-[80px] grid-cols-[1fr_auto_1fr] items-center gap-24 border-b border-border-subtle bg-surface-default px-[64px]',
		className,
	]}
>
	<div class="flex min-w-0 items-center gap-12">
		{#if member}
			<MemberAvatar name={member.name} tone={member.tone} />
			<div class="flex min-w-0 flex-col gap-2">
				<p class="truncate font-display text-[18px] font-semibold text-text-primary">
					Hey {member.name}!
				</p>
				<p class="truncate text-[12px] text-text-secondary">Ready to spin the loop?</p>
			</div>
		{/if}
	</div>

	<nav aria-label="Main">
		<ul class={['flex items-center gap-8', parent ? 'w-[600px]' : 'w-[384px]']}>
			{#each tabsFor(parent) as tab (tab.href)}
				{@const active = isTabActive(pathname, tab.href)}
				<li class="flex-1">
					<a
						href={tab.href}
						aria-current={active ? 'page' : undefined}
						class={[
							'flex h-[40px] items-center justify-center gap-8 rounded-[8px] text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange',
							active
								? 'bg-surface-accent-orange-subtle text-text-orange'
								: 'text-text-muted hover:text-text-secondary',
						]}
					>
						<TabIcon icon={tab.icon} size={20} />
						{tab.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="flex justify-end">
		{#if member}
			<PointsPill points={member.points} variant="header" />
		{/if}
	</div>
</header>
