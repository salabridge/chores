// Copy for doing a chore for someone else (SB-75, on top of SB-74). Plain
// functions so the components, the server-built facts and the tests share one
// wording. No server imports here: this file is bundled into the client.

/** "Leo's", "Chris's": a name as the owner of something. */
export const possessive = (name: string) => `${name}'s`;

/** The banner on someone else's chore, for the member who'll get the points. */
export const favourBannerTitle = (ownerName: string) =>
	`This is ${possessive(ownerName)} chore.`;

export const favourBannerText = "You'll get the points.";

/** The same banner for a parent, who picks who did it. */
export const recordBannerText = 'Choose who did it below. They get the points.';

/** "Done by Mia" next to a small avatar, when the doer isn't the assignee. */
export const doneByText = (name: string) => `Done by ${name}`;

/** Done screen: "+10 points for you. Leo's chore is covered". */
export const doneForText = (points: number, ownerName: string) =>
	`+${points} ${points === 1 ? 'point' : 'points'} for you. ${possessive(ownerName)} chore is covered 🎉`;

/** What reopening a favour does: the points leave the doer, not the assignee. */
export const reopenFavourText = (points: number, doerName: string) =>
	`Reopening takes the ${points} pts back from ${doerName}.`;

/** The label over the parent's "who did it" select. */
export const DONE_BY_LABEL = 'Done by';
