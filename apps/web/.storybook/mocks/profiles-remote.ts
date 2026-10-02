// Storybook stand-in for `src/lib/profiles.remote.ts`, aliased in `main.ts`.
// The real module is a SvelteKit remote function file that imports server
// code (auth, DB), which can't load in the browser-only Storybook build. This
// fakes just the `form()` surface the components use, and submitting does
// nothing. Mock names must not end in `.remote.ts`, because SvelteKit's
// plugin would treat them as real remote function files and rewrite them.

type Issue = { message: string };

function field(name: string) {
	return {
		as: (type: string, value?: string) => ({ name, type, value }),
		issues: (): Issue[] | undefined => undefined,
	};
}

function mockForm() {
	const fields = new Proxy(
		{ issues: (): Issue[] | undefined => undefined },
		{
			get: (target, key) =>
				key in target ? target[key as keyof typeof target] : field(String(key)),
		},
	) as { issues: () => Issue[] | undefined } & Record<
		string,
		ReturnType<typeof field>
	>;

	return {
		enhance: (_callback: unknown) => ({
			method: 'POST',
			action: '#',
			onsubmit: (event: SubmitEvent) => event.preventDefault(),
		}),
		fields,
		pending: 0,
	};
}

export const selectProfile = mockForm();
export const leaveKidProfile = mockForm();
export const savePin = mockForm();
export const unlockPin = mockForm();
