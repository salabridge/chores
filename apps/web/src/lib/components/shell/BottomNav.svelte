<script lang="ts">
	let { pathname }: { pathname: string } = $props();

	const tabs = [
		{ href: '/today', label: 'Today', icon: 'home' },
		{ href: '/rewards', label: 'Rewards', icon: 'gift' },
		{ href: '/streak', label: 'Streak', icon: 'flame' },
	] as const;

	const isActive = (href: string) =>
		pathname === href || pathname.startsWith(`${href}/`);
</script>

<nav
	aria-label="Main"
	class="sticky bottom-0 z-20 border-t border-border-subtle bg-surface-default pb-[env(safe-area-inset-bottom)]"
>
	<ul class="flex h-[72px] items-center justify-between px-32">
		{#each tabs as tab (tab.href)}
			{@const active = isActive(tab.href)}
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
					<svg
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						{#if tab.icon === 'home'}
							<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
						{:else if tab.icon === 'gift'}
							<rect x="3" y="8" width="18" height="4" rx="1" />
							<path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
						{:else}
							<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3 0 1.4 1 2.5 2.5 2.5z" />
						{/if}
					</svg>
					{tab.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
