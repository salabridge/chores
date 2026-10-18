// The member app's three tabs, shared by the phone tab bar (BottomNav) and
// the desktop header (AppHeader) so the two navs can't drift apart.

export type TabIcon = 'home' | 'gift' | 'flame';

export const tabs = [
	{ href: '/today', label: 'Today', icon: 'home' },
	{ href: '/rewards', label: 'Rewards', icon: 'gift' },
	{ href: '/streak', label: 'Streak', icon: 'flame' },
] as const satisfies readonly { href: string; label: string; icon: TabIcon }[];

/** Whether `pathname` is the tab at `href` or a page under it. */
export const isTabActive = (pathname: string, href: string) =>
	pathname === href || pathname.startsWith(`${href}/`);
