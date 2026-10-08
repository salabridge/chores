<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MemberAvatar from './MemberAvatar.svelte';
	import MemberToggleRow from './MemberToggleRow.svelte';
	import ReorderButtons from './ReorderButtons.svelte';

	const { Story } = defineMeta({
		title: 'UI/MemberToggleRow',
		component: MemberToggleRow,
		tags: ['autodocs'],
		args: { name: 'Mia', checked: true, reason: 'Too young for this chore' },
	});
</script>

{#snippet avatar()}
	<MemberAvatar name="Mia" />
{/snippet}

{#snippet actions()}
	<ReorderButtons name="Mia" />
{/snippet}

<Story name="Included" args={{ avatar }} />

<Story name="Excluded" args={{ avatar, checked: false }} />

<Story name="With reorder buttons" args={{ avatar, actions }} />

<Story name="Without avatar" />

<Story name="Disabled" args={{ avatar, disabled: true }} />
