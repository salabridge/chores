import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/** Parent PINs are 4 to 6 digits. */
export const PIN_PATTERN = /^\d{4,6}$/;

export function isValidPin(pin: unknown): pin is string {
	return typeof pin === 'string' && PIN_PATTERN.test(pin);
}

// scrypt (built into Node, so no native dependency). A PIN has at most a
// million values, so no hash makes an offline attack on a leaked row hard;
// the real defences are the lockout (see `pin-lock.ts`) and keeping the hash
// where only the parent's own row policy can read it. The salt and cost are
// still there so rows can't be compared or precomputed.
const LOG_N = 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// scrypt needs about 128 * N * r bytes; Node's default limit is exactly 32 MiB.
const MAX_MEMORY = 128 * 2 ** LOG_N * R * 2;

function derive(pin: string, salt: Buffer, logN: number, r: number, p: number) {
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(
			pin,
			salt,
			KEY_LENGTH,
			{ N: 2 ** logN, r, p, maxmem: MAX_MEMORY },
			(error, key) => (error ? reject(error) : resolve(key)),
		);
	});
}

/** Hashes a PIN into a self-describing string: `$scrypt$ln=15,r=8,p=1$<salt>$<hash>`. */
export async function hashPin(pin: string): Promise<string> {
	if (!isValidPin(pin)) throw new Error('PIN must be 4 to 6 digits');
	const salt = randomBytes(SALT_LENGTH);
	const key = await derive(pin, salt, LOG_N, R, P);
	return `$scrypt$ln=${LOG_N},r=${R},p=${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Checks a PIN against `hashPin`'s output in constant time. Malformed hashes never match. */
export async function verifyPinHash(
	pin: string,
	hash: string,
): Promise<boolean> {
	const [, scheme, params, salt, key] = hash.split('$');
	if (scheme !== 'scrypt' || !params || !salt || !key) return false;
	const values = Object.fromEntries(
		params.split(',').map((pair) => pair.split('=')),
	);
	const logN = Number(values.ln);
	const r = Number(values.r);
	const p = Number(values.p);
	if (![logN, r, p].every(Number.isInteger) || logN > LOG_N) return false;
	try {
		const expected = Buffer.from(key, 'base64');
		const actual = await derive(pin, Buffer.from(salt, 'base64'), logN, r, p);
		return (
			actual.length === expected.length && timingSafeEqual(actual, expected)
		);
	} catch {
		return false;
	}
}
