<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { exampleDraft } from '#lib/chore-creator.js';
	import ChoreEligibilityPanel from './ChoreEligibilityPanel.svelte';
	import { householdMembers } from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Chores/ChoreEligibilityPanel',
		component: ChoreEligibilityPanel,
		tags: ['autodocs'],
		args: { draft: exampleDraft(), members: householdMembers },
	});
</script>

<Story name="Rotation" />
