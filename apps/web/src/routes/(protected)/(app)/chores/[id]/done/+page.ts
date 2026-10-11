import type { PageLoad } from './$types';

// Full-bleed completion screen: opt out of the bottom tab nav.
export const load: PageLoad = () => ({ hideNav: true });
