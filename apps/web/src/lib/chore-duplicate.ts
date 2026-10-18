import {
	type ChoreDraft,
	type ChoreKind,
	dueWeekdayFor,
	type Frequency,
	newStageKey,
} from './chore-creator.ts';

// "Duplicate as…" (SB-64): `/chores/new?from=<choreId>&kind=<kind>` opens the
// Chore Creator prefilled from an existing chore. Plain data shared by the
// server load, the page, the component and the tests. No server imports: this
// is bundled into the client.

/** A chore as the creator needs it to prefill a copy. */
export interface DuplicateSource {
	id: string;
	title: string;
	note: string | null;
	kind: ChoreKind;
	frequency: Frequency;
	/** The weekly chore's due day (SB-71), or null. */
	dueWeekday: number | null;
	points: number;
	stages: { title: string; hint: string | null }[];
	/** The personal chore's assignee. */
	assigneeId: string | null;
	/** For a rotation, the member whose turn it is now. */
	currentTurnMemberId: string | null;
}

/** What the creator page gets from the load when `?from=` is set. */
export interface DuplicateInfo {
	sourceId: string;
	sourceTitle: string;
	sourceKind: ChoreKind;
	/** Whether the copy is of the other kind. */
	kindChanges: boolean;
	draft: ChoreDraft;
}

/** `kind` is optional; anything but a known kind means "same kind as the source". */
export function parseKind(value: string | null | undefined): ChoreKind | null {
	return value === 'personal' || value === 'rotation' ? value : null;
}

/**
 * The source as a draft of `kind` (default: the source's own kind). A personal
 * chore keeps its assignee; a rotation copied to personal suggests the member
 * whose turn it is; a copy to a rotation has no assignee.
 */
export function duplicateDraft(
	source: DuplicateSource,
	kind: ChoreKind = source.kind,
): ChoreDraft {
	const assigneeId =
		kind !== 'personal'
			? null
			: source.kind === 'personal'
				? source.assigneeId
				: source.currentTurnMemberId;
	return {
		title: source.title,
		note: source.note ?? '',
		kind,
		useStages: source.stages.length > 0,
		stages: source.stages.map((s) => ({
			key: newStageKey(),
			title: s.title,
			hint: s.hint ?? '',
		})),
		frequency: source.frequency,
		dueWeekday: dueWeekdayFor(source.frequency, source.dueWeekday),
		points: source.points,
		assigneeId,
	};
}

export function duplicateInfo(
	source: DuplicateSource,
	kind: ChoreKind | null,
): DuplicateInfo {
	const target = kind ?? source.kind;
	return {
		sourceId: source.id,
		sourceTitle: source.title,
		sourceKind: source.kind,
		kindChanges: target !== source.kind,
		draft: duplicateDraft(source, target),
	};
}

/** "Archive the original" starts checked when the kind changes, and off for a plain duplicate. */
export const archiveOriginalDefault = (kindChanges: boolean) => kindChanges;

/** The creator URL for a "Duplicate as…" link. Omit `kind` for a plain duplicate. */
export const duplicateHref = (choreId: string, kind?: ChoreKind) =>
	`/chores/new?from=${encodeURIComponent(choreId)}${kind ? `&kind=${kind}` : ''}`;
