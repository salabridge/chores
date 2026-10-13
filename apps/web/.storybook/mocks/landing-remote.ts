// Storybook stand-in for `src/lib/landing.remote.ts`, aliased in `main.ts`. See
// profiles-remote.ts for why. Submitting does nothing.
import { mockForm } from './profiles-remote.ts';

export const saveLanding = mockForm();
