<script lang="ts" module>
	export const OPTION_CARD_CONTEXT = Symbol('option-card-group');

	export interface OptionCardContext {
		readonly name: string;
		readonly value: string | undefined;
		readonly accent: 'orange' | 'blue';
		readonly disabled: boolean;
		select(value: string): void;
	}
</script>

<script lang="ts">
	import { type Snippet, setContext } from 'svelte';

	interface Props {
		/** Accessible name of the group. */
		label: string;
		/** Selected option's value. Bindable. */
		value?: string;
		/** Selected border colour. */
		accent?: 'orange' | 'blue';
		disabled?: boolean;
		/** Native radio group name; generated when omitted. */
		name?: string;
		class?: string;
		children: Snippet;
	}

	const generatedName = $props.id();

	let {
		label,
		value = $bindable(),
		accent = 'orange',
		disabled = false,
		name,
		class: className,
		children,
	}: Props = $props();

	setContext<OptionCardContext>(OPTION_CARD_CONTEXT, {
		get name() {
			return name ?? generatedName;
		},
		get value() {
			return value;
		},
		get accent() {
			return accent;
		},
		get disabled() {
			return disabled;
		},
		select(next) {
			value = next;
		},
	});
</script>

<!-- Cards are native radio inputs, so arrow-key navigation comes from the browser. -->
<div role="radiogroup" aria-label={label} class={['flex items-start gap-12', className]}>
	{@render children()}
</div>
