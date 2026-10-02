import type { Cookies } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { createAuthClient } from 'better-auth/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { dev } from '$app/env';
import { NEON_AUTH_URL } from '$app/env/private';
import { getRequestEvent } from '$app/server';

/** Server-to-server Neon Auth client: forwards our copy of Neon's cookies and
 * re-issues any it sets on our origin, since Neon's own never reach this app.
 * Uses `getRequestEvent()`, so only call it while handling a request. */
export const neonAuth = createAuthClient({
	baseURL: NEON_AUTH_URL,
	plugins: [emailOTPClient()],
	fetchOptions: {
		customFetchImpl: async (input, init) => {
			const event = getRequestEvent();
			const headers = new Headers(init?.headers);
			// Neon Auth rejects POSTs from origins that aren't trusted domains.
			headers.set('origin', event.url.origin);
			headers.delete('cookie');
			const cookie = upstreamCookieHeader(event.cookies);
			if (cookie) headers.set('cookie', cookie);
			const userAgent = event.request.headers.get('user-agent');
			if (userAgent) headers.set('user-agent', userAgent);
			try {
				headers.set('x-forwarded-for', event.getClientAddress());
			} catch {
				// Not every adapter can report the client address.
			}

			const res = await fetch(input, { ...init, headers });
			relayCookies(res, event.cookies);
			return res;
		},
	},
});

type NeonSession = typeof neonAuth.$Infer.Session;
export type SessionUser = NeonSession['user'];
/** The session minus its token, which must never reach the browser. */
export type SessionInfo = Omit<NeonSession['session'], 'token'>;

/** Every cookie Neon Auth sets starts with this. */
const UPSTREAM_PREFIX = '__Secure-neon-auth.';
// Some browsers (Safari) reject `__Secure-` cookies on http://localhost, so
// in dev we store them without that prefix.
const LOCAL_PREFIX = dev ? 'neon-auth.' : UPSTREAM_PREFIX;

function upstreamCookieHeader(cookies: Cookies) {
	return cookies
		.getAll()
		.filter(({ name }) => name.startsWith(LOCAL_PREFIX))
		.map(
			({ name, value }) =>
				`${UPSTREAM_PREFIX}${name.slice(LOCAL_PREFIX.length)}=${value}`,
		)
		.join('; ');
}

function relayCookies(res: Response, cookies: Cookies) {
	for (const header of res.headers.getSetCookie()) {
		const [pair = '', ...attributes] = header.split(';');
		const eq = pair.indexOf('=');
		const upstreamName = pair.slice(0, eq).trim();
		if (!upstreamName.startsWith(UPSTREAM_PREFIX)) continue;
		const name = LOCAL_PREFIX + upstreamName.slice(UPSTREAM_PREFIX.length);
		const value = pair.slice(eq + 1).trim();

		// Neon's cookies are SameSite=None/Partitioned for cross-site use; ours
		// are first-party, so Lax is enough and Partitioned is dropped. Domain is
		// dropped too since it would name Neon's host.
		const options = {
			path: '/',
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax' as const,
		};
		let maxAge: number | undefined;
		let expires: Date | undefined;
		for (const attribute of attributes) {
			const [key = '', val = ''] = attribute.split('=').map((s) => s.trim());
			if (key.toLowerCase() === 'max-age') maxAge = Number(val);
			if (key.toLowerCase() === 'expires') expires = new Date(val);
		}

		if (!value || maxAge === 0) {
			cookies.delete(name, options);
		} else {
			// The value is already encoded by Neon; don't encode it twice.
			cookies.set(name, value, {
				...options,
				maxAge,
				expires,
				encode: (v) => v,
			});
		}
	}
}

/** Drops our copies of Neon's cookies, so a failed upstream sign-out can't
 * leave someone signed in here. */
export function clearSessionCookies(cookies: Cookies) {
	for (const { name } of cookies.getAll()) {
		if (name.startsWith(LOCAL_PREFIX)) {
			cookies.delete(name, { path: '/', httpOnly: true, secure: !dev });
		}
	}
}

/**
 * Checks the account password without touching the visitor's session.
 * Neon Auth's own verify endpoint is server-only, so this signs in with a
 * separate client that keeps its cookies in memory, then signs that throwaway
 * session out again. The visitor's real cookies are never read or replaced.
 */
export async function verifyAccountPassword(
	email: string,
	password: string,
): Promise<boolean> {
	const { url } = getRequestEvent();
	const jar = new Map<string, string>();
	const client = createAuthClient({
		baseURL: NEON_AUTH_URL,
		fetchOptions: {
			customFetchImpl: async (input, init) => {
				const headers = new Headers(init?.headers);
				headers.set('origin', url.origin);
				headers.delete('cookie');
				if (jar.size) {
					headers.set(
						'cookie',
						[...jar].map(([name, value]) => `${name}=${value}`).join('; '),
					);
				}
				const res = await fetch(input, { ...init, headers });
				for (const header of res.headers.getSetCookie()) {
					const pair = header.split(';')[0] ?? '';
					const eq = pair.indexOf('=');
					if (eq > 0)
						jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
				}
				return res;
			},
		},
	});
	const { error } = await client.signIn.email({ email, password });
	if (error) return false;
	await client.signOut().catch(() => {});
	return true;
}

/** Cheap check so requests without a session skip the upstream call. */
export function hasSessionCookie(cookies: Cookies) {
	return cookies.get(`${LOCAL_PREFIX}session_token`) !== undefined;
}

/** Looks the current request's session up with Neon Auth. */
export async function fetchSession(): Promise<{
	user: SessionUser;
	session: SessionInfo;
} | null> {
	const { data, error } = await neonAuth.getSession();
	if (error) {
		console.error('Neon Auth get-session failed', error);
		return null;
	}
	if (!data) return null;
	const { token: _token, ...session } = data.session;
	return { user: data.user, session };
}

/** What an emailed code is for: finishing sign-up, signing in, or resetting a
 * forgotten password. */
export type CodePurpose = 'email-verification' | 'sign-in' | 'forget-password';

const CODE_PURPOSES: readonly string[] = [
	'email-verification',
	'sign-in',
	'forget-password',
] satisfies CodePurpose[];

/** `otp` is only set once a password-reset code has been checked, since the
 * reset itself needs it again alongside the new password. */
export type PendingCode = { email: string; purpose: CodePurpose; otp?: string };

/** Remembers who we just emailed a code to between the send and verify steps,
 * so the address stays out of the URL. */
const PENDING_CODE = 'pending-code';

export function setPendingCode(cookies: Cookies, pending: PendingCode) {
	cookies.set(PENDING_CODE, JSON.stringify(pending), {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		// Neon's codes expire well before this.
		maxAge: 60 * 15,
	});
}

export function getPendingCode(cookies: Cookies): PendingCode | null {
	try {
		const { email, purpose, otp } = JSON.parse(cookies.get(PENDING_CODE) ?? '');
		if (typeof email === 'string' && CODE_PURPOSES.includes(purpose)) {
			return typeof otp === 'string'
				? { email, purpose, otp }
				: { email, purpose };
		}
	} catch {
		// Missing or tampered with; treat as no pending code.
	}
	return null;
}

export function clearPendingCode(cookies: Cookies) {
	cookies.delete(PENDING_CODE, { path: '/', httpOnly: true, secure: !dev });
}

/** Emails a one-time code and remembers it for the verify step. */
export async function sendCode(email: string, purpose: CodePurpose) {
	const { error } = await neonAuth.emailOtp.sendVerificationOtp({
		email,
		type: purpose,
	});
	if (error) return error;
	setPendingCode(getRequestEvent().cookies, { email, purpose });
	return null;
}

/** `/verify`, keeping `redirectTo` if it goes anywhere but home. */
export function verifyUrl(redirectTo: string) {
	return redirectTo === '/'
		? '/verify'
		: `/verify?redirectTo=${encodeURIComponent(redirectTo)}`;
}

/** Where to send someone who needs to sign in, remembering where they were. */
export function signInUrl(url: URL) {
	const redirectTo = url.pathname + url.search;
	return redirectTo === '/'
		? '/login'
		: `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}

/** Returns the signed-in user or redirects to sign-in. Remote functions skip
 * the guard in `hooks.server.ts`, so those needing a user must call this. */
export function requireUser(): SessionUser {
	const { locals, url, route } = getRequestEvent();
	if (!locals.user) {
		// A remote function's URL is its endpoint, not a page worth returning to.
		redirect(303, route.id ? signInUrl(url) : '/login');
	}
	return locals.user;
}

/** Where to go after signing in: home goes through the profile picker, which skips itself for anyone without managed kids. */
export function afterSignInUrl(redirectTo: string) {
	return redirectTo === '/' ? '/profiles' : redirectTo;
}

/** Only allow same-site, path-only redirect targets. */
export function safeRedirectTarget(target: unknown) {
	return typeof target === 'string' &&
		target.startsWith('/') &&
		!target.startsWith('//') &&
		!target.startsWith('/\\')
		? target
		: '/';
}
