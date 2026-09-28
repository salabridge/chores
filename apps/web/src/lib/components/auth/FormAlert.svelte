<script lang="ts">
	let {
		issues,
		tone = 'error',
	}: {
		issues: { message: string }[] | undefined;
		/** `error` is announced assertively; `status` politely. */
		tone?: 'error' | 'status';
	} = $props();
</script>

<!-- The tokens have no red/danger color yet, so errors use the amber
     "attention" palette rather than a one-off hex value. -->
{#if issues?.length}
	<div
		role={tone === 'error' ? 'alert' : 'status'}
		class={[
			'rounded-xl border px-16 py-12 text-[14px]',
			tone === 'error'
				? 'border-border-amber bg-surface-accent-amber-subtle'
				: 'border-border-green bg-surface-accent-green-subtle',
		]}
	>
		{#each issues as issue}
			<p>{issue.message}</p>
		{/each}
	</div>
{/if}
