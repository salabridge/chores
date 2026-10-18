<script lang="ts">
	import TabIcon from './TabIcon.svelte';
	import { isTabActive, tabs } from './tabs.ts';

	let { pathname, class: className }: { pathname: string; class?: string } =
		$props();
</script>

<nav
	aria-label="Main"
	class={[
		'sticky bottom-0 z-20 border-t border-border-subtle bg-surface-default pb-[env(safe-area-inset-bottom)]',
		className,
	]}
>
	<ul class="flex h-[72px] items-center justify-between px-32">
		{#each tabs as tab (tab.href)}
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
