<script lang="ts">
	let { src }: { src: string } = $props();
</script>

<span
	class="flex size-[56px] items-center justify-center rounded-2xl bg-surface-accent-amber-subtle"
>
	<img {src} alt="" width="24" height="24" />
</span>
