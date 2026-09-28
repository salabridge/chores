<script lang="ts">
	import arrowLeft from '#lib/assets/icons/arrow-left.svg';

	let { href, label }: { href: string; label: string } = $props();
</script>

<a
	{href}
	class="flex w-fit items-center gap-12 text-[15px] font-semibold text-text-secondary"
>
	<span
		class="flex size-[40px] items-center justify-center rounded-full bg-surface-accent-orange-subtle"
	>
		<img src={arrowLeft} alt="" width="18" height="18" />
	</span>
	{label}
</a>
