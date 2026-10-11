// Where a finished chore sends the member: the celebration screen (SB-42).
// The completion id lives in the URL so the screen reads what was awarded from
// the server, and refreshing it never completes (or awards) anything again.

/** The celebration screen for one completion. */
export function completionHref(choreId: string, completionId: string): string {
	return `/chores/${encodeURIComponent(choreId)}/done?completion=${encodeURIComponent(completionId)}`;
}
