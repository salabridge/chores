<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { MemberOption } from '#lib/chore-creator.js';
	import { DONE_BY_LABEL } from '#lib/favour.js';

	/**
	 * The parent's "Done by" choice when completing a chore on someone's
	 * behalf (SB-75). Starts on the assignee, so recording a chore as it
	 * stands changes nothing; picking another member gives them the points.
	 * Spread a remote form field's `as('select')` onto it to post the choice.
	 */
	interface Props extends Omit<HTMLSelectAttributes, 'value'> {
		members: MemberOption[];
		/** The chosen member id. Bindable. */
		value?: string;
		/** Label text; defaults to "Done by". */
		label?: string;
	}

	let {
		members,
		value = $bindable(''),
		label = DONE_BY_LABEL,
		class: className,
		...rest
	}: Props = $props();

	const selectId = $props.id();
</script>

<div class="flex flex-col gap-6">
	<label for={selectId} class="text-[13px] font-semibold text-text-secondary">{label}</label>
	<select
		{...rest}
		id={selectId}
		bind:value
		class={[
			'h-[48px] w-full rounded-xl border border-border-orange bg-surface-default px-16 text-[15px] text-text-primary focus-visible:outline-2 focus-visible:outline-border-orange',
			className,
		]}
	>
		{#each members as m (m.id)}
			<option value={m.id}>{m.name}</option>
		{/each}
	</select>
</div>
