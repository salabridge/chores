import { isHttpError } from '@sveltejs/kit';

/**
 * Runs a favour action and returns the message to show when it fails, or
 * null when it worked. The server words its errors for the screen (403, 404,
 * 409), so an HTTP error's message is shown as it is.
 */
export async function runFavourAction(
	run: () => Promise<void>,
	fallback = 'Something went wrong. Try again.',
): Promise<string | null> {
	try {
		await run();
		return null;
	} catch (e) {
		if (isHttpError(e) && e.body.message) return e.body.message;
		return e instanceof Error && e.message ? e.message : fallback;
	}
}
