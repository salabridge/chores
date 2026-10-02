<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ParentPinDialog from './ParentPinDialog.svelte';

	// No autodocs: the docs page renders every story at once, and each open
	// story calls showModal(), which would stack the dialogs. The remote forms
	// are mocked in .storybook/mocks.
	const { Story } = defineMeta({
		title: 'Shell/ParentPinDialog',
		component: ParentPinDialog,
		parameters: { layout: 'fullscreen' },
		args: { open: true, memberName: 'Mia', locked: false },
	});
</script>

<Story name="Enter PIN" />

<Story name="Locked (password unlock)" args={{ locked: true }} />
