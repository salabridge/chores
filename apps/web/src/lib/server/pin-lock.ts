import { verifyPinHash } from './pin.ts';

/** Wrong PINs allowed in a row before the PIN locks. */
export const MAX_PIN_FAILURES = 5;
/** From this many failures on, attempts also have to wait out a cool-down. */
export const COOLDOWN_AFTER_FAILURES = 3;
export const COOLDOWN_MS = 30_000;

export interface PinRecord {
	memberId: string;
	pinHash: string;
	failedAttempts: number;
	lastFailedAt: Date | null;
	/** Set once the limit is hit. Only an account-password unlock clears it. */
	lockedAt: Date | null;
}

/** Storage the lockout needs; `pin-store.ts` backs it with the database. */
export interface PinStore {
	get(memberId: string): Promise<PinRecord | null>;
	/**
	 * Atomically counts an attempt (and locks at the limit), unless the PIN is
	 * already locked or cooling down. Returns the row after counting, or null
	 * when refused. Counting before the hash is compared means parallel guesses
	 * can't all slip in under the limit.
	 */
	reserveAttempt(memberId: string, now: Date): Promise<PinRecord | null>;
	/** Clears the counters, after a correct PIN or an account-password unlock. */
	reset(memberId: string): Promise<void>;
}

export type PinCheck =
	| { ok: true }
	| { ok: false; reason: 'no-pin' }
	| { ok: false; reason: 'locked' }
	| { ok: false; reason: 'cooldown'; retryAfterSeconds: number }
	| { ok: false; reason: 'incorrect'; attemptsLeft: number; locked: boolean };

/** Milliseconds until another attempt is allowed, or 0. */
export function cooldownRemainingMs(
	record: Pick<PinRecord, 'failedAttempts' | 'lastFailedAt'>,
	now: Date,
): number {
	if (record.failedAttempts < COOLDOWN_AFTER_FAILURES || !record.lastFailedAt) {
		return 0;
	}
	return Math.max(
		0,
		record.lastFailedAt.getTime() + COOLDOWN_MS - now.getTime(),
	);
}

function refusal(record: PinRecord, now: Date): PinCheck {
	if (record.lockedAt) return { ok: false, reason: 'locked' };
	return {
		ok: false,
		reason: 'cooldown',
		retryAfterSeconds: Math.max(
			1,
			Math.ceil(cooldownRemainingMs(record, now) / 1000),
		),
	};
}

/** Checks a PIN for a parent's member row, applying the rate limit and lockout. */
export async function checkPin(
	store: PinStore,
	memberId: string,
	pin: string,
	now: Date = new Date(),
): Promise<PinCheck> {
	const record = await store.get(memberId);
	if (!record) return { ok: false, reason: 'no-pin' };
	if (record.lockedAt || cooldownRemainingMs(record, now) > 0) {
		return refusal(record, now);
	}

	const reserved = await store.reserveAttempt(memberId, now);
	if (!reserved) {
		// Another attempt locked it or started a cool-down since we looked.
		const latest = await store.get(memberId);
		return latest ? refusal(latest, now) : { ok: false, reason: 'no-pin' };
	}

	if (await verifyPinHash(pin, reserved.pinHash)) {
		await store.reset(memberId);
		return { ok: true };
	}
	return {
		ok: false,
		reason: 'incorrect',
		attemptsLeft: Math.max(0, MAX_PIN_FAILURES - reserved.failedAttempts),
		locked: reserved.lockedAt !== null,
	};
}

/** What to tell the user about a failed check. */
export function pinFailureMessage(check: Exclude<PinCheck, { ok: true }>) {
	switch (check.reason) {
		case 'no-pin':
			return 'Set a parent PIN first.';
		case 'locked':
			return 'Too many wrong PINs. Enter your account password to unlock.';
		case 'cooldown':
			return `Too many wrong PINs. Try again in ${check.retryAfterSeconds} seconds.`;
		case 'incorrect':
			return check.locked
				? 'Too many wrong PINs. Enter your account password to unlock.'
				: `That PIN is not right. ${check.attemptsLeft} ${check.attemptsLeft === 1 ? 'try' : 'tries'} left.`;
	}
}
