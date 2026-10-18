import { beforeEach, describe, expect, it, vi } from 'vitest';

// `$app/env/private` is mocked so each test picks whether Resend is set up.
const env = vi.hoisted(() => ({
	RESEND_API_KEY: undefined as string | undefined,
	INVITE_EMAIL_FROM: undefined as string | undefined,
	APP_ORIGIN: 'https://chores.example' as string | undefined,
}));
vi.mock('$app/env/private', () => env);
vi.mock('$app/env', () => ({ dev: false }));

const { renderInviteEmail, sendInvite } = await import('./invite-email.ts');

const invite = {
	to: 'ava@example.com',
	householdName: 'The <Burbridge> House',
	inviterName: 'Jim & Sam',
	role: 'kid' as const,
	link: 'https://chores.example/invite/abc',
};

beforeEach(() => {
	env.RESEND_API_KEY = undefined;
	env.INVITE_EMAIL_FROM = undefined;
	env.APP_ORIGIN = 'https://chores.example';
});

describe('renderInviteEmail', () => {
	it('names the inviter, household and link, and escapes the HTML', () => {
		const { subject, text, html } = renderInviteEmail(invite);
		expect(subject).toBe(
			'Jim & Sam invited you to The <Burbridge> House on ChoreLoop',
		);
		expect(text).toContain('with your own login');
		expect(text).toContain(invite.link);
		expect(html).toContain('The &lt;Burbridge&gt; House');
		expect(html).toContain('Jim &amp; Sam');
		expect(html).not.toContain('<Burbridge>');
		expect(html).toContain(`href="${invite.link}"`);
	});

	it('says "as a parent" for parent invites', () => {
		expect(renderInviteEmail({ ...invite, role: 'parent' }).text).toContain(
			'as a parent',
		);
	});
});

describe('sendInvite', () => {
	it('skips sending when Resend is not configured', async () => {
		const fetcher = vi.fn();
		expect(await sendInvite(invite, fetcher)).toEqual({
			sent: false,
			reason: 'not-configured',
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("skips sending when the link's origin isn't configured", async () => {
		env.RESEND_API_KEY = 're_test';
		env.INVITE_EMAIL_FROM = 'ChoreLoop <invites@mail.example.com>';
		env.APP_ORIGIN = undefined;
		const fetcher = vi.fn();
		expect(await sendInvite(invite, fetcher)).toEqual({
			sent: false,
			reason: 'not-configured',
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('posts the email to Resend with the key and from address', async () => {
		env.RESEND_API_KEY = 're_test';
		env.INVITE_EMAIL_FROM = 'ChoreLoop <invites@mail.example.com>';
		const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
		expect(await sendInvite(invite, fetcher)).toEqual({ sent: true });
		const [url, init] = fetcher.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe('https://api.resend.com/emails');
		expect(new Headers(init.headers).get('authorization')).toBe(
			'Bearer re_test',
		);
		expect(JSON.parse(String(init.body))).toMatchObject({
			from: 'ChoreLoop <invites@mail.example.com>',
			to: ['ava@example.com'],
		});
	});

	it('reports a rejected or failed send instead of throwing', async () => {
		env.RESEND_API_KEY = 're_test';
		env.INVITE_EMAIL_FROM = 'invites@mail.example.com';
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(
			await sendInvite(
				invite,
				async () => new Response('bad', { status: 422 }),
			),
		).toEqual({ sent: false, reason: 'rejected' });
		expect(
			await sendInvite(invite, async () => {
				throw new Error('offline');
			}),
		).toEqual({ sent: false, reason: 'unreachable' });
		error.mockRestore();
	});
});
