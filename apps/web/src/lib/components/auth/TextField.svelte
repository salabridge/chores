<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import eye from '#lib/assets/icons/eye.svg';

	interface Props extends Omit<HTMLInputAttributes, 'class'> {
		label: string;
		/** Shown under the input, e.g. a field's `issues()`. */
		issues?: { message: string }[];
		/** Persistent helper text, shown when there are no issues. */
		hint?: string;
	}

	let { label, issues, hint, type, ...rest }: Props = $props();

	const id = $props.id();
	let revealed = $state(false);
	const isPassword = $derived(type === 'password');
	const describedBy = $derived(
		issues?.length ? `${id}-issues` : hint ? `${id}-hint` : undefined,
	);
</script>

<div class="flex flex-col gap-6">
	<label for={id} class="text-[14px] font-semibold text-text-secondary">
		{label}
	</label>
	<div
		class="flex h-[48px] items-center gap-12 rounded-xl border border-border-orange bg-surface-default px-16 focus-within:ring-2 focus-within:ring-border-orange/30"
	>
		<input
			{...rest}
			{id}
			type={isPassword && revealed ? 'text' : type}
			aria-describedby={describedBy}
			class="min-w-0 flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary"
		/>
		{#if isPassword}
			<button
				type="button"
				class="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-border-orange"
				aria-label={revealed ? 'Hide password' : 'Show password'}
				aria-pressed={revealed}
				onclick={() => (revealed = !revealed)}
			>
				<img src={eye} alt="" width="18" height="18" />
			</button>
		{/if}
	</div>
	{#if issues?.length}
		<div id="{id}-issues" class="text-[13px] text-text-amber">
			{#each issues as issue}
				<p>{issue.message}</p>
			{/each}
		</div>
	{:else if hint}
		<p id="{id}-hint" class="text-[13px] text-text-secondary">{hint}</p>
	{/if}
</div>
