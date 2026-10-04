import { invalid, redirect } from '@sveltejs/kit';
import {
	afterSignInUrl,
	clearPendingCode,
	clearSessionCookies,
	getPendingCode,
	neonAuth,
	requireUser,
	safeRedirectTarget,
	sendCode,
	setPendingCode,
	verifyUrl,
} from '#lib/server/auth.js';
import { requireNotKidProfile } from '#lib/server/guards.js';
import { form, getRequestEvent, query } from '$app/server';

/** Email/password sign-in. `neonAuth` re-issues Neon's session cookie on our
 * origin, so hooks see the session from the next request on. */
export const signIn = form(
	'unchecked',
	async (data: { email: string; _password: string; redirectTo?: string }) => {
		const email = String(data.email ?? '').trim();
		const password = String(data._password ?? '');
		if (!email || !password) invalid('Enter your email and password.');
		const redirectTo = safeRedirectTarget(data.redirectTo);

		const { error } = await neonAuth.signIn.email({ email, password });
		if (error?.code === 'EMAIL_NOT_VERIFIED') {
			// The password was right, so it's safe to say the account exists.
			// Send a code so someone who abandoned sign-up can finish it.
			if (await sendCode(email, 'email-verification')) {
				invalid('Verify your email before signing in.');
			}
			redirect(303, verifyUrl(redirectTo));
		}
		if (error) invalid('Incorrect email or password.');

		redirect(303, afterSignInUrl(redirectTo));
	},
);

/** Email/password sign-up. Whether Neon signs the new user straight in depends
 * on the branch's "require email verification" setting; when it doesn't, we
 * email a code and finish on `/verify`. */
export const signUp = form(
	'unchecked',
	async (data: {
		name: string;
		email: string;
		_password: string;
		terms?: boolean;
		redirectTo?: string;
	}) => {
		const name = String(data.name ?? '').trim();
		const email = String(data.email ?? '').trim();
		const password = String(data._password ?? '');
		if (!name || !email || !password) {
			invalid('Enter your name, email and a password.');
		}
		if (data.terms !== true) {
			invalid('Agree to the Terms of Service and Privacy Policy to continue.');
		}
		const redirectTo = safeRedirectTarget(data.redirectTo);

		const { data: result, error } = await neonAuth.signUp.email({
			name,
			email,
			password,
		});
		if (error) invalid(signUpErrorMessage(error.code));
		if (result?.token) redirect(303, redirectTo);

		if (await sendCode(email, 'email-verification')) {
			invalid('Account created, but we could not send a verification code.');
		}
		redirect(303, verifyUrl(redirectTo));
	},
);

function signUpErrorMessage(code: string | undefined) {
	switch (code) {
		case 'USER_ALREADY_EXISTS':
		case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
			return 'An account with that email already exists.';
		case 'INVALID_EMAIL':
			return 'Enter a valid email address.';
		case 'PASSWORD_TOO_SHORT':
			return 'That password is too short.';
		case 'PASSWORD_TOO_LONG':
			return 'That password is too long.';
		default:
			return 'Could not create your account. Try again.';
	}
}

/** First step of passwordless sign-in: email a one-time code. */
export const sendSignInCode = form(
	'unchecked',
	async (data: { email: string; redirectTo?: string }) => {
		const email = String(data.email ?? '').trim();
		if (!email) invalid('Enter your email.');

		if (await sendCode(email, 'sign-in')) {
			invalid('Could not send a code to that email.');
		}
		redirect(303, verifyUrl(safeRedirectTarget(data.redirectTo)));
	},
);

/** Checks the code emailed by `sendCode`. Sign-in and email verification end
 * signed in (Neon auto-signs-in after verification, and its cookies are relayed
 * as usual); a password-reset code moves on to choosing a new password. */
export const verifyCode = form(
	'unchecked',
	async (data: { otp: string; redirectTo?: string }) => {
		const { cookies } = getRequestEvent();
		const pending = getPendingCode(cookies);
		if (!pending) redirect(303, '/login');

		const otp = String(data.otp ?? '').trim();
		if (!otp) invalid('Enter the code from your email.');

		const { email, purpose } = pending;
		const { error } =
			purpose === 'sign-in'
				? await neonAuth.signIn.emailOtp({ email, otp })
				: purpose === 'forget-password'
					? // Only checks the code; `resetPassword` consumes it.
						await neonAuth.emailOtp.checkVerificationOtp({
							email,
							otp,
							type: purpose,
						})
					: await neonAuth.emailOtp.verifyEmail({ email, otp });
		if (error) invalid(codeErrorMessage(error.code));

		if (purpose === 'forget-password') {
			setPendingCode(cookies, { email, purpose, otp });
			redirect(303, '/reset-password');
		}
		clearPendingCode(cookies);
		redirect(303, afterSignInUrl(safeRedirectTarget(data.redirectTo)));
	},
);

function codeErrorMessage(code: string | undefined) {
	switch (code) {
		case 'TOO_MANY_ATTEMPTS':
			return 'Too many attempts. Send a new code.';
		case 'OTP_EXPIRED':
			return 'That code has expired. Send a new one.';
		default:
			return 'That code is not right.';
	}
}

/** First step of resetting a forgotten password: email a one-time code. Neon
 * answers the same whether or not the account exists, so this doesn't reveal
 * which emails are registered. */
export const requestPasswordReset = form(
	'unchecked',
	async (data: { email: string }) => {
		const email = String(data.email ?? '').trim();
		if (!email) invalid('Enter your email.');

		if (await sendCode(email, 'forget-password')) {
			invalid('Could not send a code to that email.');
		}
		redirect(303, '/verify');
	},
);

/** Last step of a password reset, once `verifyCode` has checked the code.
 * Doesn't sign in, so the new password gets used straight away. */
export const resetPassword = form(
	'unchecked',
	async (data: { _password: string }) => {
		const { cookies } = getRequestEvent();
		const pending = getPendingCode(cookies);
		if (pending?.purpose !== 'forget-password' || !pending.otp) {
			redirect(303, '/forgot-password');
		}

		const password = String(data._password ?? '');
		if (!password) invalid('Choose a new password.');

		const { email, otp } = pending;
		const { error } = await neonAuth.emailOtp.resetPassword({
			email,
			otp,
			password,
		});
		if (error) {
			switch (error.code) {
				case 'PASSWORD_TOO_SHORT':
					invalid('That password is too short.');
					break;
				case 'PASSWORD_TOO_LONG':
					invalid('That password is too long.');
					break;
				default:
					// The code expired or was used up between checking it and now.
					clearPendingCode(cookies);
					invalid(`${codeErrorMessage(error.code)} Start the reset again.`);
			}
		}

		clearPendingCode(cookies);
		redirect(303, '/login?reset=1');
	},
);

/** Emails a fresh code for whatever `/verify` is waiting on. */
export const resendCode = form(async () => {
	const pending = getPendingCode(getRequestEvent().cookies);
	if (!pending) redirect(303, '/login');
	if (await sendCode(pending.email, pending.purpose)) {
		invalid('Could not send a new code. Try again shortly.');
	}
	return { sent: true };
});

/** Ends the session with Neon Auth and clears our copy of its cookies. Refused
 * (403) while a managed kid profile is active: the parent has to leave it with
 * the PIN first, so a kid can't sign the parent out by posting here directly. */
export const signOut = form(async () => {
	await requireNotKidProfile();
	const { locals, cookies } = getRequestEvent();
	if (locals.user) {
		const { error } = await neonAuth.signOut();
		if (error) console.error('Neon Auth sign-out failed', error);
	}
	clearSessionCookies(cookies);
	redirect(303, '/login');
});

/** Changes the signed-in user's password from the account page. Other devices
 * are signed out so a stolen session doesn't survive the change. */
export const setPassword = form(
	'unchecked',
	async (data: { _currentPassword: string; _newPassword: string }) => {
		// A kid profile must not be able to change the parent's password.
		await requireNotKidProfile();
		requireUser();

		const currentPassword = String(data._currentPassword ?? '');
		const newPassword = String(data._newPassword ?? '');
		if (!currentPassword || !newPassword) {
			invalid('Enter your current and new password.');
		}

		const { error } = await neonAuth.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: true,
		});
		if (error) {
			switch (error.code) {
				case 'INVALID_PASSWORD':
					invalid('Your current password is not right.');
					break;
				case 'PASSWORD_TOO_SHORT':
					invalid('That password is too short.');
					break;
				case 'PASSWORD_TOO_LONG':
					invalid('That password is too long.');
					break;
				default:
					console.error('Neon Auth change-password failed', error);
					invalid('Could not change your password. Try again.');
			}
		}

		return { changed: true };
	},
);

export const getSession = query(async () => {
	const evt = getRequestEvent();
	return evt.locals.session;
});

export const getUser = query(async () => {
	const evt = getRequestEvent();
	return evt.locals.user;
});
