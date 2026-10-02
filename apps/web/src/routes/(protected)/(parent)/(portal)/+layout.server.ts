import { loadParentPortal } from '#lib/server/parent-portal.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => loadParentPortal();
