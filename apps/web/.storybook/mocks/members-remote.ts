// Storybook stand-in for `src/lib/members.remote.ts`, aliased in `main.ts`.
// See profiles-remote.ts for why: the real module imports server code.
// Submitting does nothing.
import { mockForm } from './profiles-remote.ts';

export const addManagedKidMember = mockForm();
