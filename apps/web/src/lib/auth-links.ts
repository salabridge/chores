// Links between the auth pages that keep `redirectTo`, so a flow started
// from a deep link (an invite) comes back to it.

/**
 * Only same-origin, path-only redirect targets; anything else is `/`. Checks
 * the target the way a browser will resolve it: browsers drop tab, CR and LF
 * while parsing a URL and treat `\` as `/`, so `/\t/evil.example` would
 * become `//evil.example`. Those characters, and other control characters,
 * are refused outright, and what's left has to resolve to our own origin.
 */
export function safeRedirectTarget(target: unknown): string {
	if (typeof target !== 'string' || !target.startsWith('/')) return '/';
	for (const char of target) {
		const code = char.charCodeAt(0);
		if (code < 0x20 || code === 0x7f || char === '\\') return '/';
	}
	const base = 'http://internal.invalid';
	const url = new URL(target, base);
	if (url.origin !== base) return '/';
	return url.pathname + url.search + url.hash;
}

/** `path`, carrying `redirectTo` along unless it's home. */
export function withRedirect(path: string, redirectTo: string): string {
	return redirectTo === '/'
		? path
		: `${path}?redirectTo=${encodeURIComponent(redirectTo)}`;
}
