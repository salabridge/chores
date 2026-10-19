<script lang="ts">
	import Logo from '#lib/components/ui/Logo.svelte';
</script>

<header
	class="flex h-[80px] items-center justify-between border-b border-border-subtle px-24 lg:h-[88px] lg:px-[120px]"
>
	<Logo />
	<a
		href="/login"
		class="rounded-[6px] text-[15px] font-semibold text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-orange"
		>Sign in</a
	>
</header>
