<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { emptyDraft, exampleDraft } from '#lib/chore-creator.js';
	import ChoreEligibilityPanel from './ChoreEligibilityPanel.svelte';
	import { householdMembers } from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Chores/ChoreEligibilityPanel',
		component: ChoreEligibilityPanel,
		tags: ['autodocs'],
		args: {
			draft: exampleDraft(),
			members: householdMembers,
			active: true,
			onsave: fn(async () => {}),
		},
	});
</script>

<Story name="Rotation" />

<Story name="Before continuing" args={{ active: false }} />

<Story name="Save fails" args={{ onsave: async () => { throw new Error('Could not save this chore. Try again.'); } }} />

<Story name="Personal chore" args={{ draft: emptyDraft('personal'), active: false }} />
