import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

// The browser specs only render on the client, where a prop passed after a
// field's `{...field.as('text')}` spread just wins. On the server Svelte copies
// the spread's property descriptors, and `.as()` makes `value` non-configurable,
// so the same markup throws "Cannot redefine property: value" (SB-91).
vi.mock(
	'#lib/setup.remote.js',
	() => import('../../../.storybook/mocks/setup-remote.ts'),
);
vi.mock(
	'#lib/members.remote.js',
	() => import('../../../.storybook/mocks/members-remote.ts'),
);

import AddManagedKidForm from './members/AddManagedKidForm.svelte';
import EditMemberAvatarForm from './members/EditMemberAvatarForm.svelte';
import { members } from './members/fixtures.ts';
import GiftPointsForm from './members/GiftPointsForm.svelte';
import HouseholdStep from './setup/HouseholdStep.svelte';
import KidsStep from './setup/KidsStep.svelte';
import ParentStep from './setup/ParentStep.svelte';

const cases: [string, () => ReturnType<typeof render>][] = [
	[
		'HouseholdStep',
		() => render(HouseholdStep, { props: { timezone: 'America/Chicago' } }),
	],
	[
		'ParentStep',
		() =>
			render(ParentStep, {
				props: { displayName: 'Mom', avatarColor: 'orange' },
			}),
	],
	['KidsStep', () => render(KidsStep, { props: { kids: [] } })],
	[
		'AddManagedKidForm',
		() => render(AddManagedKidForm, { props: { kidCount: 2 } }),
	],
	[
		'EditMemberAvatarForm',
		() => render(EditMemberAvatarForm, { props: { member: members[2] } }),
	],
	[
		'GiftPointsForm',
		() => render(GiftPointsForm, { props: { member: members[2] } }),
	],
];

describe('form components rendered on the server', () => {
	it.each(cases)('%s renders', async (_name, renderComponent) => {
		const { body } = await renderComponent();
		expect(body).toContain('<form');
	});
});
