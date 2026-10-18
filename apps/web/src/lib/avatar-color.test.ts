import { describe, expect, it } from 'vitest';
import {
	AVATAR_PRESETS,
	avatarHexStyle,
	isAvatarColor,
	isHexColor,
	normalizeAvatarColor,
	resolveAvatarColor,
} from './avatar-color.ts';

describe('isAvatarColor', () => {
	it('accepts every preset key', () => {
		for (const preset of AVATAR_PRESETS)
			expect(isAvatarColor(preset)).toBe(true);
	});

	it('accepts six-digit hex in either case', () => {
		expect(isAvatarColor('#a1b2c3')).toBe(true);
		expect(isAvatarColor('#A1B2C3')).toBe(true);
	});

	it.each([
		'pink',
		'',
		'#abc',
		'#abcdef0',
		'abcdef',
		'#ggg000',
		'#12345g',
		' #a1b2c3',
		'red; background: url(x)',
		null,
		undefined,
		42,
	])('rejects %j', (value) => {
		expect(isAvatarColor(value)).toBe(false);
	});

	it('includes red among the presets', () => {
		expect(AVATAR_PRESETS).toContain('red');
	});
});

describe('normalizeAvatarColor', () => {
	it('lower-cases hex and leaves presets alone', () => {
		expect(normalizeAvatarColor('#A1B2C3')).toBe('#a1b2c3');
		expect(normalizeAvatarColor('blue')).toBe('blue');
	});
});

describe('isHexColor', () => {
	it('is false for presets', () => {
		expect(isHexColor('blue')).toBe(false);
	});
});

describe('resolveAvatarColor', () => {
	it('resolves presets and hex', () => {
		expect(resolveAvatarColor('green')).toEqual({
			kind: 'preset',
			preset: 'green',
		});
		expect(resolveAvatarColor('#AABBCC')).toEqual({
			kind: 'hex',
			hex: '#aabbcc',
		});
	});

	it.each(['teal', '', null, undefined, '#12', 7])(
		'falls back to orange for %j',
		(value) => {
			expect(resolveAvatarColor(value)).toEqual({
				kind: 'preset',
				preset: 'orange',
			});
		},
	);
});

describe('avatarHexStyle', () => {
	it('uses the hex as the ring', () => {
		expect(avatarHexStyle('#A1B2C3')).toContain('border-color: #a1b2c3');
	});

	it('derives fill and text from theme tokens so both themes stay legible', () => {
		const style = avatarHexStyle('#a1b2c3');
		expect(style).toContain(
			'background-color: color-mix(in srgb, #a1b2c3 18%, var(--color-background-base))',
		);
		expect(style).toContain(
			'color: color-mix(in srgb, #a1b2c3 55%, var(--color-text-primary))',
		);
	});
});
