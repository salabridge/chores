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
		/** Nothing was submitted, so no field has a value yet. */
		value: (): string | undefined => undefined,
	};
}

const attributes = {
	method: 'POST',
	action: '#',
	onsubmit: (event: SubmitEvent) => event.preventDefault(),
};

type Fields = { issues: () => Issue[] | undefined } & Record<
	string,
	ReturnType<typeof field>
>;

type MockForm = typeof attributes & {
	enhance: (callback: unknown) => typeof attributes;
	fields: Fields;
	pending: number;
	result: Record<string, unknown> | undefined;
	for: (id: unknown) => MockForm;
};

export function mockForm(): MockForm {
	const fields = new Proxy(
		{ issues: (): Issue[] | undefined => undefined },
		{
			get: (target, key) =>
				key in target ? target[key as keyof typeof target] : field(String(key)),
		},
	) as Fields;

	// `<form {...form}>` spreads the form object, so only the attributes are
	// enumerable, like the real remote form.
	return Object.defineProperties(
		{ ...attributes },
		{
			enhance: { value: (_callback: unknown) => ({ ...attributes }) },
			fields: { value: fields },
			pending: { value: 0 },
			result: { value: undefined },
			// One instance per list item (`form.for(id)`); all of them do nothing.
			for: { value: (_id: unknown) => mockForm() },
		},
	) as MockForm;
}

type EnhanceCallback = (form: {
	element: HTMLFormElement;
	submit: () => Promise<boolean>;
}) => unknown;

/**
 * For specs: `form`, except that submitting runs the `enhance` callback with
 * `submit` (by default one that succeeds), so what a component does around a
 * submit (confirming first, resetting after) can be checked. Items from
 * `.for(id)` behave the same way.
 */
export function submittable(
	form: MockForm,
	submit: () => Promise<boolean> = async () => true,
): MockForm {
	return Object.defineProperties(
		{ ...attributes },
		{
			enhance: {
				value: (callback: EnhanceCallback) => ({
					...attributes,
					onsubmit: (event: SubmitEvent) => {
						event.preventDefault();
						const element = event.currentTarget as HTMLFormElement;
						void callback({ element, submit });
					},
				}),
			},
			fields: { value: form.fields },
			pending: { value: 0 },
			result: { value: undefined },
			for: { value: (id: unknown) => submittable(form.for(id), submit) },
		},
	) as MockForm;
}

export const selectProfile = mockForm();
export const leaveKidProfile = mockForm();
export const savePin = mockForm();
export const unlockPin = mockForm();
