// The member app's tabs, shared by the phone tab bar (BottomNav) and the
// desktop header (AppHeader) so the two navs can't drift apart.

export type TabIcon = 'home' | 'gift' | 'flame' | 'grid' | 'user';

type Tab = { href: string; label: string; icon: TabIcon };

export const tabs = [
	{ href: '/today', label: 'Today', icon: 'home' },
	{ href: '/rewards', label: 'Rewards', icon: 'gift' },
	{ href: '/streak', label: 'Streak', icon: 'flame' },
] as const satisfies readonly Tab[];

// Pages under the `(parent)` group. Only a parent acting as themselves can
// open them (hooks.server.ts), so only they get these tabs.
export const parentTabs = [
	{ href: '/overview', label: 'Overview', icon: 'grid' },
	{ href: '/account', label: 'Account', icon: 'user' },
] as const satisfies readonly Tab[];

/** The tabs to show: the member tabs, plus the parent ones for a parent. */
export const tabsFor = (parent: boolean): readonly Tab[] =>
	parent ? [...tabs, ...parentTabs] : tabs;

/** Whether `pathname` is the tab at `href` or a page under it. */
export const isTabActive = (pathname: string, href: string) =>
	pathname === href || pathname.startsWith(`${href}/`);
