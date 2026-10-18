/**
 * Avatar colours: a preset key (a design-token family) or a custom
 * `#rrggbb` hex. Both are stored as-is in `household_members.avatar_color`.
 */
export const AVATAR_PRESETS = [
	'orange',
	'blue',
	'green',
	'amber',
	'red',
] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export const DEFAULT_AVATAR_PRESET: AvatarPreset = 'orange';

/** Where the custom colour input starts when nothing custom is chosen yet. */
export const DEFAULT_CUSTOM_COLOR = '#8b5cf6';

const HEX = /^#[0-9a-f]{6}$/i;

/** Token classes per preset: ring, subtle fill, text. */
export const AVATAR_PRESET_CLASSES: Record<AvatarPreset, string> = {
	orange:
		'border-border-orange bg-surface-accent-orange-subtle text-text-orange',
	blue: 'border-border-blue bg-surface-accent-blue-subtle text-text-blue',
	green: 'border-border-green bg-surface-accent-green-subtle text-text-green',
	amber: 'border-border-amber bg-surface-accent-amber-subtle text-text-amber',
	red: 'border-border-red bg-surface-accent-red-subtle text-text-red',
};

export const isAvatarPreset = (value: unknown): value is AvatarPreset =>
	(AVATAR_PRESETS as readonly string[]).includes(String(value));

export const isHexColor = (value: unknown): value is string =>
	typeof value === 'string' && HEX.test(value);

/** A preset key or a 6-digit hex (any case). */
export const isAvatarColor = (value: unknown): value is string =>
	isAvatarPreset(value) || isHexColor(value);

/** Lower-cases a hex; presets pass through. Callers validate first. */
export const normalizeAvatarColor = (value: string): string =>
	isHexColor(value) ? value.toLowerCase() : value;

export type ResolvedAvatarColor =
	| { kind: 'preset'; preset: AvatarPreset }
	| { kind: 'hex'; hex: string };

/** Turns a stored value into something renderable; unknown values get the default preset. */
export const resolveAvatarColor = (value: unknown): ResolvedAvatarColor => {
	if (isHexColor(value)) return { kind: 'hex', hex: value.toLowerCase() };
	if (isAvatarPreset(value)) return { kind: 'preset', preset: value };
	return { kind: 'preset', preset: DEFAULT_AVATAR_PRESET };
};

/**
 * Inline style for a custom-hex avatar. The ring is the hex itself. The fill
 * is a light wash of it over the page background, and the text mixes it into
 * the theme's primary text colour, so both follow light/dark themes.
 */
export const avatarHexStyle = (hex: string): string => {
	const h = hex.toLowerCase();
	return [
		`border-color: ${h}`,
		`background-color: color-mix(in srgb, ${h} 18%, var(--color-background-base))`,
		`color: color-mix(in srgb, ${h} 55%, var(--color-text-primary))`,
	].join('; ');
};
