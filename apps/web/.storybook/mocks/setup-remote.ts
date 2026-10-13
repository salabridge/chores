// Storybook stand-in for `src/lib/setup.remote.ts`, aliased in `main.ts`. See
// profiles-remote.ts for why: the real module imports server code. Submitting
// does nothing.
import { mockForm } from './profiles-remote.ts';

export const saveHouseholdStep = mockForm();
export const saveParentStep = mockForm();
export const addKidStep = mockForm();
export const removeKidStep = mockForm();
export const finishSetupStep = mockForm();
