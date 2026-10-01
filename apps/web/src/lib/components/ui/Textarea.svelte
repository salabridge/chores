<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLTextareaAttributes, 'class'> {
		label: string;
		/** Shown under the field, e.g. a field's `issues()`. */
		issues?: { message: string }[];
		/** Persistent helper text, shown when there are no issues. */
		hint?: string;
	}

	let {
		label,
		issues,
		hint,
		value = $bindable(),
		rows = 3,
		...rest
	}: Props = $props();

	const id = $props.id();
	const describedBy = $derived(
		issues?.length ? `${id}-issues` : hint ? `${id}-hint` : undefined,
	);
</script>

<div class="flex flex-col gap-6">
	<label for={id} class="text-[14px] font-semibold text-text-secondary">
		{label}
	</label>
	<textarea
		{...rest}
		{id}
		{rows}
		bind:value
		aria-describedby={describedBy}
		aria-invalid={issues?.length ? true : undefined}
		class="min-h-[48px] w-full resize-y rounded-xl border border-border-orange bg-surface-default px-16 py-12 text-[15px] text-text-primary outline-none placeholder:text-text-secondary focus:ring-2 focus:ring-border-orange/30"
	></textarea>
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
