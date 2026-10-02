<script lang="ts">
	import Logo from '#lib/components/ui/Logo.svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import { parentLabel } from '#lib/parent-label.js';

	let {
		pathname,
		parentNames = [],
	}: {
		/** Current URL path, used to mark the active nav item. */
		pathname: string;
		/** Display names of the household's parents, for the footer. */
		parentNames?: string[];
	} = $props();

	const items = [
		{ href: '/overview', label: 'Overview', icon: 'grid' },
		{ href: '/chores/new', label: 'Create & Assign', icon: 'plus' },
		{ href: '/rotations', label: 'Rotation Builder', icon: 'refresh' },
	] as const;

	const isActive = (href: string) =>
		pathname === href || pathname.startsWith(`${href}/`);

	const label = $derived(parentLabel(parentNames));

	// Below `lg` the sidebar is a top bar; the nav opens from a menu button
	// and closes again after navigating.
	let open = $state(false);
	$effect(() => {
		void pathname;
		open = false;
	});
</script>

<aside
	class="flex shrink-0 flex-col border-b border-border-subtle bg-surface-default lg:sticky lg:top-0 lg:h-dvh lg:w-[260px] lg:gap-32 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-24"
>
	<div class="flex h-[56px] items-center justify-between px-16 lg:h-auto lg:p-0">
		<Logo href="/overview" />
		<button
			type="button"
			class="flex size-[36px] items-center justify-center rounded-[10px] border border-border-subtle text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange lg:hidden"
			aria-label="Menu"
			aria-expanded={open}
			aria-controls="parent-nav-panel"
			onclick={() => (open = !open)}
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
			>
				{#if open}
					<path d="M18 6 6 18M6 6l12 12" />
				{:else}
					<path d="M4 6h16M4 12h16M4 18h16" />
				{/if}
			</svg>
		</button>
	</div>

	<div
		id="parent-nav-panel"
		class={[
			'flex-col gap-32 px-16 pb-16 lg:flex lg:gap-32 lg:p-0',
			open ? 'flex' : 'hidden',
		]}
	>
		<nav aria-label="Parent portal">
			<ul class="flex flex-col gap-8">
				{#each items as item (item.href)}
					{@const active = isActive(item.href)}
					<li>
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class={[
								'flex items-center gap-12 rounded-[12px] px-12 py-10 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange',
								active
									? 'bg-surface-accent-orange-subtle font-semibold text-text-orange'
									: 'font-medium text-text-secondary hover:bg-background-base',
							]}
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								{#if item.icon === 'grid'}
									<rect width="7" height="7" x="3" y="3" rx="1" />
									<rect width="7" height="7" x="14" y="3" rx="1" />
									<rect width="7" height="7" x="14" y="14" rx="1" />
									<rect width="7" height="7" x="3" y="14" rx="1" />
								{:else if item.icon === 'plus'}
									<circle cx="12" cy="12" r="10" />
									<path d="M8 12h8M12 8v8" />
								{:else}
									<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
									<path d="M21 3v5h-5" />
									<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
									<path d="M8 16H3v5" />
								{/if}
							</svg>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="flex flex-col gap-12 border-t border-border-subtle pt-24">
			<p class="text-[12px] text-text-muted">PARENT PORTAL ACTIVE</p>
			<div class="flex items-center gap-8">
				<MemberAvatar name={label.name} size="sm" />
				<div class="flex min-w-0 flex-col">
					<span
						class="truncate font-display text-[13px] font-semibold text-text-primary"
						>{label.name}</span
					>
					<span class="text-[11px] text-text-secondary">{label.role}</span>
				</div>
			</div>
		</div>
	</div>
</aside>
