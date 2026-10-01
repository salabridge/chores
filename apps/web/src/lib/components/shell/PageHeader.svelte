<script lang="ts">
	let {
		label,
		backHref = '/today',
	}: {
		/** Centered page label, e.g. "Personal Chore". */
		label: string;
		backHref?: string;
	} = $props();
</script>

<header
	class="sticky top-0 z-10 grid h-[56px] grid-cols-[1fr_auto_1fr] items-center bg-background-base px-24"
>
	<a
		href={backHref}
		class="w-fit text-[15px] font-semibold text-text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange"
	>
		<span aria-hidden="true">←</span> Back
	</a>
	<h1 class="font-display text-[17px] font-bold text-text-primary">{label}</h1>
	<span aria-hidden="true"></span>
</header>
