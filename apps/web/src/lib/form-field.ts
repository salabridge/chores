/**
 * A remote form field's `.as()` attributes without `value`, for an input that
 * passes its own `value` after the spread. `.as()` makes `value`
 * non-configurable and Svelte's server renderer copies spread props'
 * descriptors as-is, so passing `value` again throws "Cannot redefine
 * property: value" during SSR (SB-91).
 */
export function withoutValue<T extends { value?: unknown }>(
	attributes: T,
): Omit<T, 'value'> {
	const { value: _value, ...rest } = attributes;
	return rest;
}
