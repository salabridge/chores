// Links between the auth pages that keep `redirectTo`, so a flow started
// from a deep link (an invite) comes back to it.

/** `path`, carrying `redirectTo` along unless it's home. */
export function withRedirect(path: string, redirectTo: string): string {
	return redirectTo === '/'
		? path
		: `${path}?redirectTo=${encodeURIComponent(redirectTo)}`;
}
