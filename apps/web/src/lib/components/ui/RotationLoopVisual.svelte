<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import MemberAvatar from './MemberAvatar.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLOListElement>, 'children'> {
		/** Member who completed the previous turn. */
		doneLast: string;
		/** Member whose turn it is; highlighted. */
		active: string;
		/** Member who is next in the loop. */
		nextUp: string;
	}

	let { doneLast, active, nextUp, class: className, ...rest }: Props = $props();

	const nodes = $derived([
		{ name: doneLast, label: 'Done Last', current: false },
		{ name: active, label: 'Active Turn', current: true },
		{ name: nextUp, label: 'Next Up', current: false },
	]);
</script>

<ol {...rest} class={['m-0 grid list-none grid-cols-3 gap-12 p-0', className]}>
	{#each nodes as node (node.label)}
		<li
			data-current={node.current}
			aria-current={node.current ? 'step' : undefined}
			class="flex min-w-0 flex-col items-center gap-8 text-center"
		>
			<MemberAvatar name={node.name} size="lg" active={node.current} />
			<span
				class={[
					'max-w-full text-[13px] font-semibold break-words',
					node.current ? 'text-text-orange' : 'text-text-primary',
				]}
			>
				{node.name}
			</span>
			<span
				class={[
					'text-[11px]',
					node.current ? 'text-text-orange' : 'text-text-secondary',
				]}
			>
				{node.label}
			</span>
		</li>
	{/each}
</ol>
