import { describe, expect, it } from 'vitest';
import {
	currentStep,
	parseHouseholdInput,
	parseKidInput,
	parseParentInput,
	pickStarterChores,
	resolveSetupStatus,
	type SetupMembership,
	setupRedirect,
} from './setup.ts';

const ME = 'user-me';
const membership = (over: Partial<SetupMembership> = {}): SetupMembership => ({
	householdId: 'h1',
	memberId: 'm1',
	role: 'owner',
	householdCreatedBy: ME,
	householdName: 'The Smiths',
	householdTimezone: 'America/Chicago',
	setupCompletedAt: null,
	...over,
});

describe('resolveSetupStatus', () => {
	it('needs setup with no household yet', () => {
		expect(resolveSetupStatus(ME, [])).toEqual({
			needsSetup: true,
			household: null,
		});
	});

	it('resumes an unfinished household the user created', () => {
		const status = resolveSetupStatus(ME, [membership()]);
		expect(status.needsSetup).toBe(true);
		expect(status.household).toEqual({
			id: 'h1',
			name: 'The Smiths',
			timezone: 'America/Chicago',
			memberId: 'm1',
		});
	});

	it('does not send members of a finished household', () => {
		const done = membership({ setupCompletedAt: new Date() });
		expect(resolveSetupStatus(ME, [done]).needsSetup).toBe(false);
	});

	it('never sends an invited user, even into an unfinished household', () => {
		const invited = membership({
			role: 'parent',
			householdCreatedBy: 'someone-else',
		});
		expect(resolveSetupStatus(ME, [invited]).needsSetup).toBe(false);
		const invitedKid = membership({ role: 'kid', householdCreatedBy: 'x' });
		expect(resolveSetupStatus(ME, [invitedKid]).needsSetup).toBe(false);
	});

	it('does not send a user who also belongs to a finished household', () => {
		const status = resolveSetupStatus(ME, [
			membership(),
			membership({
				householdId: 'h2',
				memberId: 'm2',
				householdCreatedBy: 'other',
				role: 'parent',
				setupCompletedAt: new Date(),
			}),
		]);
		expect(status.needsSetup).toBe(false);
	});
});

describe('currentStep', () => {
	const base = {
		hasHousehold: true,
		parentSaved: true,
		kidCount: 1,
		hasPin: true,
	};

	it('walks the steps in order', () => {
		expect(currentStep({ ...base, hasHousehold: false })).toBe('household');
		expect(currentStep({ ...base, parentSaved: false })).toBe('parent');
		expect(currentStep({ ...base, kidCount: 0 })).toBe('kids');
		expect(currentStep({ ...base, hasPin: false })).toBe('pin');
		expect(currentStep(base)).toBe('chores');
	});

	it('resumes at the first unfinished step, not the last one reached', () => {
		expect(
			currentStep({
				hasHousehold: true,
				parentSaved: false,
				kidCount: 2,
				hasPin: true,
			}),
		).toBe('parent');
	});
});

describe('parseHouseholdInput', () => {
	it('trims the name and accepts an IANA time zone', () => {
		expect(
			parseHouseholdInput({
				name: '  The Smiths ',
				timezone: 'America/Chicago',
			}),
		).toEqual({
			ok: true,
			value: { name: 'The Smiths', timezone: 'America/Chicago' },
		});
	});

	it('rejects a blank or long name', () => {
		expect(parseHouseholdInput({ name: '  ', timezone: 'UTC' }).ok).toBe(false);
		expect(
			parseHouseholdInput({ name: 'x'.repeat(81), timezone: 'UTC' }).ok,
		).toBe(false);
	});

	it('rejects an unknown time zone', () => {
		expect(parseHouseholdInput({ name: 'A', timezone: 'Mars/Base' }).ok).toBe(
			false,
		);
		expect(parseHouseholdInput({ name: 'A', timezone: '' }).ok).toBe(false);
	});
});

describe('parseParentInput', () => {
	it('requires a 1 to 50 character name and a known colour', () => {
		expect(
			parseParentInput({ displayName: 'Mom', avatarColor: 'blue' }),
		).toEqual({
			ok: true,
			value: { displayName: 'Mom', avatarColor: 'blue', avatarInitial: null },
		});
		expect(parseParentInput({ displayName: '', avatarColor: 'blue' }).ok).toBe(
			false,
		);
		expect(
			parseParentInput({ displayName: 'x'.repeat(51), avatarColor: 'blue' }).ok,
		).toBe(false);
		expect(
			parseParentInput({ displayName: 'Mom', avatarColor: 'pink' }).ok,
		).toBe(false);
	});

	it('limits the initial to two characters', () => {
		const ok = parseParentInput({
			displayName: 'Mom',
			avatarColor: 'blue',
			avatarInitial: 'MJ',
		});
		expect(ok.ok && ok.value.avatarInitial).toBe('MJ');
		expect(
			parseParentInput({
				displayName: 'Mom',
				avatarColor: 'blue',
				avatarInitial: 'MJX',
			}).ok,
		).toBe(false);
	});
});

describe('parseKidInput', () => {
	const kid = { displayName: 'Mia', avatarColor: 'green' };

	it('defaults the goal to 200 and the birth year to none', () => {
		const result = parseKidInput(kid, 2026);
		expect(result.ok && result.value.weeklyGoalPoints).toBe(200);
		expect(result.ok && result.value.birthYear).toBeNull();
	});

	it('checks the birth year range', () => {
		expect(parseKidInput({ ...kid, birthYear: '2018' }, 2026).ok).toBe(true);
		expect(parseKidInput({ ...kid, birthYear: '1899' }, 2026).ok).toBe(false);
		expect(parseKidInput({ ...kid, birthYear: '2027' }, 2026).ok).toBe(false);
		expect(parseKidInput({ ...kid, birthYear: '20.5' }, 2026).ok).toBe(false);
	});

	it('checks the weekly goal', () => {
		expect(parseKidInput({ ...kid, weeklyGoalPoints: '0' }).ok).toBe(true);
		expect(parseKidInput({ ...kid, weeklyGoalPoints: '-1' }).ok).toBe(false);
		expect(parseKidInput({ ...kid, weeklyGoalPoints: '1.5' }).ok).toBe(false);
		expect(parseKidInput({ ...kid, weeklyGoalPoints: '99999' }).ok).toBe(false);
	});

	it('words the name error for a kid', () => {
		const result = parseKidInput({ ...kid, displayName: ' ' });
		expect(!result.ok && result.message).toBe("Enter your kid's name.");
	});
});

describe('pickStarterChores', () => {
	it('keeps known ids once, in preset order', () => {
		expect(
			pickStarterChores(['trash', 'make-bed', 'nope', 'trash']).map(
				(c) => c.id,
			),
		).toEqual(['make-bed', 'trash']);
		expect(pickStarterChores(undefined)).toEqual([]);
	});
});

describe('setupRedirect', () => {
	it('sends people who need setup from home and protected routes', () => {
		expect(setupRedirect('/', true)).toBe('/setup');
		expect(setupRedirect('/(protected)/(app)/today', true)).toBe('/setup');
		expect(setupRedirect('/(protected)/(parent)/(portal)/overview', true)).toBe(
			'/setup',
		);
		expect(setupRedirect('/(protected)/(parent)/profiles', true)).toBe(
			'/setup',
		);
	});

	it('lets them stay on setup and on public pages', () => {
		expect(setupRedirect('/(protected)/setup', true)).toBeNull();
		expect(setupRedirect('/login', true)).toBeNull();
		expect(setupRedirect(null, true)).toBeNull();
	});

	it('sends finished and invited users away from setup only', () => {
		expect(setupRedirect('/(protected)/setup', false)).toBe('/today');
		expect(setupRedirect('/', false)).toBeNull();
		expect(setupRedirect('/(protected)/(app)/today', false)).toBeNull();
	});
});
