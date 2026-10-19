<script lang="ts">
	import TabIcon from './TabIcon.svelte';
	import { isTabActive, tabsFor } from './tabs.ts';

	let {
		pathname,
		parent = false,
		class: className,
	}: {
		pathname: string;
		/** A parent acting as themselves also gets the Overview and Account tabs. */
		parent?: boolean;
		class?: string;
	} = $props();
</script>

<nav
	aria-label="Main"
	class={[
		'sticky bottom-0 z-20 border-t border-border-subtle bg-surface-default pb-[env(safe-area-inset-bottom)]',
		className,
	]}
>
	<!-- Five tabs only fit the 402px column with the narrower gutter. -->
	<ul
		class={[
			'flex h-[72px] items-center justify-between',
			parent ? 'px-8' : 'px-32',
		]}
	>
		{#each tabsFor(parent) as tab (tab.href)}
			{@const active = isTabActive(pathname, tab.href)}
			<li>
				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class={[
						'flex w-[64px] flex-col items-center gap-4 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange',
						active
							? 'font-semibold text-text-orange'
							: 'font-medium text-text-muted',
					]}
				>
					<TabIcon icon={tab.icon} />
					{tab.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
