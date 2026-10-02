import { beforeAll, describe, expect, it } from 'vitest';
import { hashPin } from './pin.ts';
import {
	COOLDOWN_AFTER_FAILURES,
	COOLDOWN_MS,
	checkPin,
	MAX_PIN_FAILURES,
	type PinRecord,
	type PinStore,
	pinFailureMessage,
} from './pin-lock.ts';

const MEMBER = 'member-1';

/** In-memory `PinStore` that applies the same rules as the SQL in `pin-store.ts`. */
function memoryStore(
	pinHash: string | null,
): PinStore & { row: PinRecord | null } {
	const store = {
		row: pinHash
			? {
					memberId: MEMBER,
					pinHash,
					failedAttempts: 0,
					lastFailedAt: null,
					lockedAt: null,
				}
			: (null as PinRecord | null),
		async get() {
			return store.row ? { ...store.row } : null;
		},
		async reserveAttempt(_memberId: string, now: Date) {
			const row = store.row;
			if (!row || row.lockedAt) return null;
			const cooling =
				row.failedAttempts >= COOLDOWN_AFTER_FAILURES &&
				row.lastFailedAt !== null &&
				row.lastFailedAt.getTime() > now.getTime() - COOLDOWN_MS;
			if (cooling) return null;
			row.failedAttempts += 1;
			row.lastFailedAt = now;
			row.lockedAt = row.failedAttempts >= MAX_PIN_FAILURES ? now : null;
			return { ...row };
		},
		async reset() {
			if (store.row) {
				store.row.failedAttempts = 0;
				store.row.lastFailedAt = null;
				store.row.lockedAt = null;
			}
		},
	};
	return store;
}

let hash: string;
beforeAll(async () => {
	hash = await hashPin('1234');
});

const at = (seconds: number) => new Date(1_700_000_000_000 + seconds * 1000);

describe('checkPin', () => {
	it('accepts the right PIN and clears earlier failures', async () => {
		const store = memoryStore(hash);
		await checkPin(store, MEMBER, '0000', at(0));
		expect(await checkPin(store, MEMBER, '1234', at(1))).toEqual({ ok: true });
		expect(store.row?.failedAttempts).toBe(0);
	});

	it('reports a missing PIN', async () => {
		expect(await checkPin(memoryStore(null), MEMBER, '1234', at(0))).toEqual({
			ok: false,
			reason: 'no-pin',
		});
	});

	it('counts down the tries left on a wrong PIN', async () => {
		const store = memoryStore(hash);
		expect(await checkPin(store, MEMBER, '0000', at(0))).toEqual({
			ok: false,
			reason: 'incorrect',
			attemptsLeft: MAX_PIN_FAILURES - 1,
			locked: false,
		});
	});

	it('rate limits: attempts after the third wait out a cool-down, even with the right PIN', async () => {
		const store = memoryStore(hash);
		for (let i = 0; i < COOLDOWN_AFTER_FAILURES; i++) {
			await checkPin(store, MEMBER, '0000', at(i));
		}
		const blocked = await checkPin(store, MEMBER, '1234', at(5));
		expect(blocked).toMatchObject({ ok: false, reason: 'cooldown' });
		expect(store.row?.failedAttempts).toBe(COOLDOWN_AFTER_FAILURES);

		const later = at(COOLDOWN_AFTER_FAILURES + COOLDOWN_MS / 1000);
		expect(await checkPin(store, MEMBER, '1234', later)).toEqual({ ok: true });
	});

	it('locks after the maximum failures and stays locked for the right PIN', async () => {
		const store = memoryStore(hash);
		let last: Awaited<ReturnType<typeof checkPin>> | undefined;
		for (let i = 0; i < MAX_PIN_FAILURES; i++) {
			// Space attempts past the cool-down so only the lockout stops them.
			last = await checkPin(store, MEMBER, '0000', at(i * 100));
		}
		expect(last).toEqual({
			ok: false,
			reason: 'incorrect',
			attemptsLeft: 0,
			locked: true,
		});
		expect(await checkPin(store, MEMBER, '1234', at(10_000))).toEqual({
			ok: false,
			reason: 'locked',
		});
	});

	it('unlocks once the counters are reset (the account-password unlock)', async () => {
		const store = memoryStore(hash);
		for (let i = 0; i < MAX_PIN_FAILURES; i++) {
			await checkPin(store, MEMBER, '0000', at(i * 100));
		}
		await store.reset(MEMBER);
		expect(await checkPin(store, MEMBER, '1234', at(10_000))).toEqual({
			ok: true,
		});
	});

	it('does not let parallel guesses beat the limit', async () => {
		const store = memoryStore(hash);
		const results = await Promise.all(
			Array.from({ length: 10 }, () => checkPin(store, MEMBER, '0000', at(0))),
		);
		expect(store.row?.failedAttempts).toBeLessThanOrEqual(MAX_PIN_FAILURES);
		expect(results.filter((r) => r.ok)).toHaveLength(0);
	});
});

describe('pinFailureMessage', () => {
	it('points a locked PIN at the account password', () => {
		expect(pinFailureMessage({ ok: false, reason: 'locked' })).toMatch(
			/account password/,
		);
		expect(
			pinFailureMessage({
				ok: false,
				reason: 'incorrect',
				attemptsLeft: 0,
				locked: true,
			}),
		).toMatch(/account password/);
	});

	it('says how long to wait and how many tries are left', () => {
		expect(
			pinFailureMessage({
				ok: false,
				reason: 'cooldown',
				retryAfterSeconds: 12,
			}),
		).toMatch(/12 seconds/);
		expect(
			pinFailureMessage({
				ok: false,
				reason: 'incorrect',
				attemptsLeft: 1,
				locked: false,
			}),
		).toMatch(/1 try left/);
	});
});
