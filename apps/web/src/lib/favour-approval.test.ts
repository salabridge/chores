import { describe, expect, it } from 'vitest';
import {
	approvedByOwner,
	approvedByParent,
	declinedByOwner,
	declinedByParent,
	NOW,
	needsOk,
	waitingForParent,
} from './components/favours/fixtures.ts';
import { favourBannerText, pendingByText } from './favour.ts';
import {
	myFavourState,
	navBadgeText,
	needsOkLead,
	needsOkPoints,
	panelDetail,
	panelLine,
	pendingFavourRole,
	pendingFavourViewerText,
	whenText,
} from './favour-approval.ts';

describe('myFavourState', () => {
	it('waits for the owner, naming the points', () => {
		expect(myFavourState(needsOk)).toMatchObject({
			kind: 'waiting',
			title: 'Waiting for Leo',
		});
		expect(myFavourState(needsOk).text).toContain(
			'+10 pts when Leo (or a parent)',
		);
	});

	it('waits for a parent once escalated', () => {
		expect(myFavourState(waitingForParent)).toMatchObject({
			kind: 'waiting-parent',
			title: 'Waiting for a parent',
		});
	});

	it('says who approved', () => {
		expect(myFavourState(approvedByOwner).title).toBe('+10 pts, Leo approved');
		expect(myFavourState(approvedByParent).title).toBe(
			'+20 pts, Dad (a parent) approved',
		);
	});

	it('says who declined, and whether a parent can still be asked', () => {
		expect(myFavourState(declinedByOwner)).toMatchObject({
			kind: 'declined',
			title: 'Leo said not done',
		});
		expect(myFavourState(declinedByOwner).text).toContain('ask a parent');
		expect(myFavourState(declinedByParent).title).toBe(
			'Dad (a parent) said not done',
		);
		expect(myFavourState(declinedByParent).text).not.toContain('ask a parent');
	});

	it('uses singular points', () => {
		expect(myFavourState({ ...needsOk, points: 1 }).text).toContain('+1 pt ');
	});
});

describe('copy', () => {
	it('words the approval card', () => {
		expect(needsOkLead('Mia')).toBe('Mia says they did');
		expect(needsOkPoints(10, 'Mia')).toBe('+10 pts go to Mia.');
		expect(needsOkPoints(1, null)).toBe('+1 pt go to them.');
	});

	it('words the banner, status table and nav badge', () => {
		expect(favourBannerText('Leo')).toBe(
			'Leo approves it, then you get the points.',
		);
		expect(pendingByText('Mia')).toBe('Pending: Mia');
		expect(navBadgeText(3)).toBe('3');
		expect(navBadgeText(10)).toBe('9+');
	});

	it('words the parent panel row', () => {
		expect(panelLine(needsOk)).toBe('Mia did Take Out Trash');
		expect(panelDetail(needsOk, NOW)).toBe("Leo's chore · 10 pts · 5 min ago");
	});

	it('words what a bystander sees', () => {
		const favour = {
			completionId: 'c',
			doneBy: { memberId: 'mia', name: 'Mia' },
			escalated: false,
		};
		expect(pendingFavourViewerText(favour, 'Leo')).toContain('Waiting for Leo');
		expect(
			pendingFavourViewerText({ ...favour, escalated: true }, 'Leo'),
		).toContain('A parent will decide');
	});
});

describe('whenText', () => {
	const at = (minutes: number) =>
		new Date(NOW.getTime() - minutes * 60000).toISOString();

	it('goes from minutes to days', () => {
		expect(whenText(at(0), NOW)).toBe('just now');
		expect(whenText(at(59), NOW)).toBe('59 min ago');
		expect(whenText(at(180), NOW)).toBe('3 hr ago');
		expect(whenText(at(24 * 60), NOW)).toBe('1 day ago');
		expect(whenText(at(3 * 24 * 60), NOW)).toBe('3 days ago');
	});
});

describe('pendingFavourRole', () => {
	const favour = {
		completionId: 'c',
		doneBy: { memberId: 'mia', name: 'Mia' },
		escalated: false,
	};
	const viewer = (id: string, isOwner = false, isParent = false) => ({
		id,
		isOwner,
		isParent,
	});

	it('lets the doer follow along, never decide', () => {
		expect(pendingFavourRole(favour, viewer('mia', false, true))).toBe('doer');
	});

	it('lets the owner decide until it goes to a parent', () => {
		expect(pendingFavourRole(favour, viewer('leo', true))).toBe('decider');
		expect(
			pendingFavourRole({ ...favour, escalated: true }, viewer('leo', true)),
		).toBe('viewer');
	});

	it('lets a parent decide any time', () => {
		expect(
			pendingFavourRole(
				{ ...favour, escalated: true },
				viewer('dad', false, true),
			),
		).toBe('decider');
	});

	it('leaves everyone else a bystander', () => {
		expect(pendingFavourRole(favour, viewer('sam'))).toBe('viewer');
	});
});
