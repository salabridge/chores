import { householdMemberPins } from '@chore/db';
import { and, eq, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { db } from './drizzle.ts';
import {
	COOLDOWN_AFTER_FAILURES,
	COOLDOWN_MS,
	MAX_PIN_FAILURES,
	type PinRecord,
	type PinStore,
} from './pin-lock.ts';

// Uses the owner connection (like the rest of `db`), so these queries skip the
// table's RLS: callers must pass the signed-in parent's own member id, which
// `profiles.remote.ts` takes from the server-resolved profile, never from the
// client.
export const pinStore: PinStore = {
	async get(memberId) {
		const [row] = await db
			.select()
			.from(householdMemberPins)
			.where(eq(householdMemberPins.memberId, memberId));
		return row ?? null;
	},

	async reserveAttempt(memberId, now) {
		const cutoff = new Date(now.getTime() - COOLDOWN_MS);
		const [row] = await db
			.update(householdMemberPins)
			.set({
				failedAttempts: sql`${householdMemberPins.failedAttempts} + 1`,
				lastFailedAt: now,
				lockedAt: sql`case when ${householdMemberPins.failedAttempts} + 1 >= ${MAX_PIN_FAILURES} then ${now.toISOString()}::timestamptz else null end`,
			})
			.where(
				and(
					eq(householdMemberPins.memberId, memberId),
					isNull(householdMemberPins.lockedAt),
					or(
						lt(householdMemberPins.failedAttempts, COOLDOWN_AFTER_FAILURES),
						isNull(householdMemberPins.lastFailedAt),
						lte(householdMemberPins.lastFailedAt, cutoff),
					),
				),
			)
			.returning();
		return row ?? null;
	},

	async reset(memberId) {
		await db
			.update(householdMemberPins)
			.set({ failedAttempts: 0, lastFailedAt: null, lockedAt: null })
			.where(eq(householdMemberPins.memberId, memberId));
	},
};

/** Creates or replaces a parent's PIN hash, clearing any lockout. */
export async function savePinHash(memberId: string, pinHash: string) {
	await db
		.insert(householdMemberPins)
		.values({ memberId, pinHash })
		.onConflictDoUpdate({
			target: householdMemberPins.memberId,
			set: { pinHash, failedAttempts: 0, lastFailedAt: null, lockedAt: null },
		});
}

export type { PinRecord };
