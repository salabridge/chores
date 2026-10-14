import { beforeEach, describe, expect, it, vi } from 'vitest';

// The load decides what the creator gets for `?from=`; reading the chore and
// scoping it to the household are loadDuplicateSource's, stubbed here.
const mocks = vi.hoisted(() => ({
	loadDuplicateSource: vi.fn(),
	listHouseholdMembers: vi.fn(),
	requireParentProfile: vi.fn(),
}));

vi.mock('#lib/server/guards.js', () => ({
	requireParentProfile: mocks.requireParentProfile,
}));
vi.mock('#lib/server/chores.js', () => ({
	listHouseholdMembers: mocks.listHouseholdMembers,
}));
vi.mock('#lib/server/chore-duplicate.js', () => ({
	loadDuplicateSource: mocks.loadDuplicateSource,
}));

const { load } = await import('./+page.server.ts');

const members = [{ id: 'mia', name: 'Mia' }];
const rotation = {
	id: 'c2',
	title: 'Bathroom',
	note: null,
	kind: 'rotation',
	frequency: 'daily',
	points: 15,
	stages: [],
	assigneeId: null,
	currentTurnMemberId: 'mia',
};

const run = (query: string) =>
	load({ url: new URL(`http://x/chores/new${query}`) } as never) as Promise<{
		members: unknown;
		duplicate: {
			sourceId: string;
			kindChanges: boolean;
			draft: { kind: string; assigneeId: string | null; title: string };
		} | null;
	}>;

beforeEach(() => {
	vi.resetAllMocks();
	mocks.requireParentProfile.mockResolvedValue({
		actor: { householdId: 'h1' },
	});
	mocks.listHouseholdMembers.mockResolvedValue(members);
});

describe('chores/new load', () => {
	it('has no duplicate without ?from=', async () => {
		expect(await run('')).toEqual({ members, duplicate: null });
		expect(mocks.loadDuplicateSource).not.toHaveBeenCalled();
	});

	it("looks the source up in the caller's own household", async () => {
		mocks.loadDuplicateSource.mockResolvedValue(rotation);
		await run('?from=c2&kind=personal');
		expect(mocks.loadDuplicateSource).toHaveBeenCalledWith('h1', 'c2');
	});

	it("prefills a rotation as a personal chore for whoever's turn it is", async () => {
		mocks.loadDuplicateSource.mockResolvedValue(rotation);
		const { duplicate } = await run('?from=c2&kind=personal');
		expect(duplicate).toMatchObject({
			sourceId: 'c2',
			kindChanges: true,
			draft: { kind: 'personal', assigneeId: 'mia', title: 'Bathroom' },
		});
	});

	it('keeps the source kind when kind is omitted or unknown', async () => {
		mocks.loadDuplicateSource.mockResolvedValue(rotation);
		for (const query of [
			'?from=c2',
			'?from=c2&kind=nope',
			'?from=c2&kind=rotation',
		]) {
			const { duplicate } = await run(query);
			expect(duplicate?.kindChanges).toBe(false);
			expect(duplicate?.draft.kind).toBe('rotation');
		}
	});

	it('rejects with 404 a source that is missing, archived, or in another household', async () => {
		mocks.loadDuplicateSource.mockResolvedValue(null);
		await expect(run('?from=other')).rejects.toMatchObject({ status: 404 });
	});

	it('requires a parent', async () => {
		mocks.requireParentProfile.mockRejectedValue({ status: 403 });
		await expect(run('?from=c2')).rejects.toMatchObject({ status: 403 });
		expect(mocks.loadDuplicateSource).not.toHaveBeenCalled();
	});
});
