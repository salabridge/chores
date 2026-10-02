import { describe, expect, it } from 'vitest';
import { hashPin, isValidPin, verifyPinHash } from './pin.ts';

describe('isValidPin', () => {
	it('accepts 4 to 6 digits only', () => {
		for (const pin of ['1234', '12345', '123456', '0000']) {
			expect(isValidPin(pin)).toBe(true);
		}
		for (const pin of ['123', '1234567', 'abcd', '12 34', '12.4', '', 1234]) {
			expect(isValidPin(pin)).toBe(false);
		}
	});
});

describe('hashPin / verifyPinHash', () => {
	it('never contains the PIN and verifies only the right one', async () => {
		const hash = await hashPin('4821');
		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$/);
		expect(hash).not.toContain('4821');
		expect(await verifyPinHash('4821', hash)).toBe(true);
		expect(await verifyPinHash('4822', hash)).toBe(false);
	});

	it('salts, so the same PIN hashes differently each time', async () => {
		expect(await hashPin('1234')).not.toBe(await hashPin('1234'));
	});

	it('refuses to hash an invalid PIN', async () => {
		await expect(hashPin('12')).rejects.toThrow();
	});

	it('treats malformed hashes as a mismatch rather than throwing', async () => {
		for (const hash of [
			'',
			'plain',
			'$scrypt$$$',
			'$argon2id$v=19$x$y',
			'$scrypt$ln=99,r=8,p=1$AAAA$AAAA',
		]) {
			expect(await verifyPinHash('1234', hash)).toBe(false);
		}
	});
});
