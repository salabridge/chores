// The parent PIN and the account password guard a device the kids use too, so
// their inputs opt out of password managers: an autofilled secret would let
// the kid holding the device leave their profile or reset the PIN.
// `autocomplete="off"` keeps the browser's own manager from filling text
// fields, but Chrome and Safari ignore it on `type="password"` and still offer
// to save and fill; the data attributes cover the extensions that honour a
// per-field hint (1Password, LastPass, Bitwarden).

/** Spread onto a PIN or password input shown on a shared device. */
export const noPasswordManager = {
	autocomplete: 'off',
	'data-1p-ignore': '',
	'data-lpignore': 'true',
	'data-bwignore': '',
} as const;
