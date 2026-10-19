<script lang="ts">
	import { doneByText } from '#lib/favour.js';
	import MemberAvatar from './MemberAvatar.svelte';

	/**
	 * "Done by Mia" with a small avatar, shown wherever a completion's doer
	 * isn't the assignee (SB-75): a sibling did the chore as a favour and got
	 * the points.
	 */
	interface Props {
		/** The member who did it. */
		name: string;
		class?: string;
	}

	let { name, class: className }: Props = $props();
</script>

<span
	class={['inline-flex items-center gap-6 text-[12px] font-semibold text-text-secondary', className]}
	data-testid="done-by"
>
	<MemberAvatar {name} size="sm" tone="blue" aria-hidden="true" class="size-[20px]! text-[10px]!" />
	<span>{doneByText(name)}</span>
</span>
