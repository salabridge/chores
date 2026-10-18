import { dev } from '$app/env';
import {
	APP_ORIGIN,
	INVITE_EMAIL_FROM,
	RESEND_API_KEY,
} from '$app/env/private';
import type { InviteRole } from '../invites.ts';

// Invite emails (SB-66), sent through Resend's HTTP API. Kept behind
// `sendInvite()` so the provider can be swapped. The Members screen always
// shows the link too, so a send that's skipped or fails still leaves the
// parent a way to share it.

export interface InviteEmail {
	to: string;
	householdName: string;
	inviterName: string;
	role: InviteRole;
	link: string;
}

const escapeHtml = (text: string) =>
	text.replace(
		/[&<>"']/g,
		(c) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
				c
			] as string,
	);

/** The message itself, as plain text and HTML. */
export function renderInviteEmail(invite: InviteEmail) {
	const as = invite.role === 'parent' ? 'as a parent' : 'with your own login';
	const subject = `${invite.inviterName} invited you to ${invite.householdName} on ChoreLoop`;
	const text = [
		`${invite.inviterName} invited you to join ${invite.householdName} on ChoreLoop ${as}.`,
		'',
		`Accept the invite: ${invite.link}`,
		'',
		`Sign up or sign in with ${invite.to}. The link works for 7 days.`,
		"If you weren't expecting this, you can ignore it.",
	].join('\n');
	const e = {
		inviter: escapeHtml(invite.inviterName),
		household: escapeHtml(invite.householdName),
		to: escapeHtml(invite.to),
		link: escapeHtml(invite.link),
	};
	const html = `<!doctype html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1f1f1f; line-height: 1.5">
	<p>${e.inviter} invited you to join <strong>${e.household}</strong> on ChoreLoop ${as}.</p>
	<p><a href="${e.link}" style="display: inline-block; padding: 10px 16px; border-radius: 10px; background: #f97316; color: #fff; text-decoration: none; font-weight: 600">Accept the invite</a></p>
	<p style="font-size: 13px; color: #555">Sign up or sign in with ${e.to}. The link works for 7 days. If you weren't expecting this, you can ignore it.</p>
</body>
</html>`;
	return { subject, text, html };
}

export type SendResult = { sent: true } | { sent: false; reason: string };

/**
 * Emails the invite. Without `RESEND_API_KEY` and `INVITE_EMAIL_FROM` (local
 * dev, e2e, previews) it skips sending; in dev it logs the link instead. It
 * also skips without `APP_ORIGIN`: the link's origin then came from request
 * headers, and an emailed credential mustn't. A
 * failed send is logged and reported, never thrown: the invite already exists.
 */
export async function sendInvite(
	invite: InviteEmail,
	fetcher: typeof fetch = fetch,
): Promise<SendResult> {
	if (!RESEND_API_KEY || !INVITE_EMAIL_FROM || !APP_ORIGIN) {
		// The link is a credential, so it only goes to the console locally.
		if (dev) console.info(`Invite for ${invite.to}: ${invite.link}`);
		return { sent: false, reason: 'not-configured' };
	}
	const { subject, text, html } = renderInviteEmail(invite);
	try {
		const response = await fetcher('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${RESEND_API_KEY}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				from: INVITE_EMAIL_FROM,
				to: [invite.to],
				subject,
				text,
				html,
			}),
		});
		if (!response.ok) {
			console.error(
				'Resend rejected an invite email',
				response.status,
				await response.text(),
			);
			return { sent: false, reason: 'rejected' };
		}
		return { sent: true };
	} catch (e) {
		console.error('Could not reach Resend for an invite email', e);
		return { sent: false, reason: 'unreachable' };
	}
}
