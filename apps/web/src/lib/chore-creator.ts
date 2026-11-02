// What the Chore Creator (SB-48) edits, as plain data shared by the form, the
// remote function, and the tests. No server imports: this is bundled into the
// client, and the same validation runs again on the server.

import { type IsoWeekday, isIsoWeekday, scheduleLabel } from './weekdays.ts';

export const FREQUENCIES = ['daily', 'weekly', 'weekends'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** The presets the creator offers; the database accepts any non-negative integer. */
export const POINT_OPTIONS = [5, 10, 15, 20] as const;

export type ChoreKind = 'personal' | 'rotation';

export const MAX_TITLE_LENGTH = 100;
export const MAX_NOTE_LENGTH = 1000;
export const MAX_STAGE_TITLE_LENGTH = 100;
export const MAX_STAGE_HINT_LENGTH = 500;
export const MAX_STAGES = 12;

export interface StageDraft {
	/** Client-only key so reordering keeps each row's focus and text. */
	key: string;
	/** The saved stage's id when editing (SB-63); absent on stages added in the form. */
	id?: string;
	title: string;
	hint: string;
	/** Points awarded when this stage is checked off. 0 awards nothing. */
	points: number;
}

/**
 * The chore as the parent is filling it in. Each stage carries its own points,
 * awarded as the stage is finished; `points` is a bonus on top, awarded once
 * after the last stage (all of a single-step chore's points). The form can
 * split a total evenly across the stages (`splitPoints`), but only the
 * resulting per-stage numbers are saved.
 */
export interface ChoreDraft {
	title: string;
	note: string;
	/** Personal chore / Assign Individual vs Household Rotation (one choice, shown twice). */
	kind: ChoreKind;
	useStages: boolean;
	stages: StageDraft[];
	frequency: Frequency;
	/**
	 * The day a weekly chore is due (SB-71), or null for any day that week.
	 * Kept while the parent flips frequency in the form, but only saved for
	 * weekly chores (`dueWeekdayFor`).
	 */
	dueWeekday: IsoWeekday | null;
	points: number;
	/** The member a personal chore belongs to. */
	assigneeId: string | null;
}

export interface MemberOption {
	id: string;
	name: string;
}

let keyCounter = 0;
export const newStageKey = () => `stage-${++keyCounter}`;

export const emptyStage = (): StageDraft => ({
	key: newStageKey(),
	title: '',
	hint: '',
	points: 0,
});

export const emptyDraft = (kind: ChoreKind = 'personal'): ChoreDraft => ({
	title: '',
	note: '',
	kind,
	useStages: false,
	stages: [],
	frequency: 'daily',
	dueWeekday: null,
	points: 10,
	assigneeId: null,
});

/** "Review Example": a finished rotation chore, so parents can see what one looks like. */
export const exampleDraft = (): ChoreDraft => ({
	title: 'Bathroom Rotation',
	note: 'Wipe the sink and mirror, then clean the toilet and sweep the floor.',
	kind: 'rotation',
	useStages: true,
	stages: [
		{
			key: newStageKey(),
			title: 'Clear the counter',
			hint: 'Put toothbrushes and soap back in their spots.',
			points: 5,
		},
		{
			key: newStageKey(),
			title: 'Wipe the sink and mirror',
			hint: 'Use the blue cloth and spray under the cabinet.',
			points: 5,
		},
		{
			key: newStageKey(),
			title: 'Clean the toilet and sweep',
			hint: 'Gloves are under the sink.',
			points: 5,
		},
	],
	frequency: 'daily',
	dueWeekday: null,
	points: 0,
	assigneeId: null,
});

export const frequencyLabel = (frequency: Frequency) =>
	({ daily: 'Daily', weekly: 'Weekly', weekends: 'Weekends' })[frequency];

/**
 * The due day that is saved with this frequency: the chosen day for a weekly
 * chore, otherwise null (the database only allows one on weekly chores).
 */
export const dueWeekdayFor = (
	frequency: Frequency,
	dueWeekday: number | null | undefined,
): IsoWeekday | null =>
	frequency === 'weekly' && isIsoWeekday(dueWeekday) ? dueWeekday : null;

/**
 * The green badge on step 4: "Daily • 15 pts", "Weekly · Thu • 15 pts". The
 * points are the chore's total: its own plus every stage's.
 */
export const frequencySummary = (
	draft: Pick<ChoreDraft, 'frequency' | 'points'> &
		Partial<Pick<ChoreDraft, 'dueWeekday' | 'useStages' | 'stages'>>,
) =>
	`${scheduleLabel(draft.frequency, dueWeekdayFor(draft.frequency, draft.dueWeekday))} • ${totalPoints(draft)} pts`;

/** The grey hint under the points chips. */
export function pointsHint(draft: Pick<ChoreDraft, 'frequency' | 'useStages'>) {
	const tail = draft.useStages
		? 'Split evenly across the stages; each stage pays out as it is finished. You can change any stage below.'
		: 'You can adjust this later.';
	return `${frequencyLabel(draft.frequency)} chores usually land between 5 and 20 points. ${tail}`;
}

/** The stage rows that count: only while stages are on. */
export const activeStages = (
	draft: Pick<ChoreDraft, 'useStages' | 'stages'>,
) => (draft.useStages ? draft.stages : []);

/**
 * Splits `total` points across `count` stages as whole numbers that add back
 * up to `total`. Any remainder goes one point at a time to the earliest
 * stages, so 50 over 3 is 17, 17, 16: a kid who stops partway has banked a
 * little more, never a little less.
 */
export function splitPoints(total: number, count: number): number[] {
	if (count <= 0) return [];
	const whole = Number.isInteger(total) && total > 0 ? total : 0;
	const base = Math.floor(whole / count);
	const extra = whole % count;
	return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** The stages with `total` points split evenly across them (see `splitPoints`). */
export function splitAcrossStages(
	stages: readonly StageDraft[],
	total: number,
): StageDraft[] {
	const shares = splitPoints(total, stages.length);
	return stages.map((s, i) => ({ ...s, points: shares[i] ?? 0 }));
}

/** The points the stages are worth together; a stage with an invalid value counts as 0. */
export const stagePointsTotal = (
	stages: readonly Pick<StageDraft, 'points'>[],
) =>
	stages.reduce(
		(sum, s) =>
			sum + (Number.isInteger(s.points) && s.points > 0 ? s.points : 0),
		0,
	);

/**
 * Everything the chore can earn: its own points plus each stage's. This is the
 * one number the form, the lists, and the kid's screens show as "N pts".
 */
export const totalPoints = (
	draft: Pick<ChoreDraft, 'points'> &
		Partial<Pick<ChoreDraft, 'useStages' | 'stages'>>,
) =>
	draft.points +
	(draft.useStages && draft.stages ? stagePointsTotal(draft.stages) : 0);

export function addStage(stages: readonly StageDraft[]): StageDraft[] {
	return stages.length >= MAX_STAGES ? [...stages] : [...stages, emptyStage()];
}

export const removeStage = (stages: readonly StageDraft[], key: string) =>
	stages.filter((s) => s.key !== key);

export function moveStage(
	stages: readonly StageDraft[],
	key: string,
	direction: 'up' | 'down',
): StageDraft[] {
	const next = [...stages];
	const from = next.findIndex((s) => s.key === key);
	const to = direction === 'up' ? from - 1 : from + 1;
	if (from === -1 || to < 0 || to >= next.length) return next;
	[next[from], next[to]] = [next[to], next[from]];
	return next;
}

export interface DraftErrors {
	title?: string;
	note?: string;
	/** The stage list as a whole ("add at least one stage"). */
	stages?: string;
	/** By stage key. */
	stage: Record<string, { title?: string; hint?: string; points?: string }>;
	points?: string;
	assignee?: string;
}

export const hasErrors = (errors: DraftErrors) =>
	Boolean(
		errors.title ||
			errors.note ||
			errors.stages ||
			errors.points ||
			errors.assignee ||
			Object.keys(errors.stage).length,
	);

/** Whether the draft can be saved or continued, worded for the form. */
export function validateDraft(draft: ChoreDraft): DraftErrors {
	const errors: DraftErrors = { stage: {} };

	const title = draft.title.trim();
	if (!title) errors.title = 'Give the chore a title.';
	else if (title.length > MAX_TITLE_LENGTH)
		errors.title = `Keep the title under ${MAX_TITLE_LENGTH} characters.`;

	if (draft.note.length > MAX_NOTE_LENGTH)
		errors.note = `Keep the note under ${MAX_NOTE_LENGTH} characters.`;

	if (draft.useStages) {
		if (draft.stages.length === 0) {
			errors.stages = 'Add at least one stage, or switch to Single Step.';
		}
		for (const stage of draft.stages) {
			const problems: { title?: string; hint?: string; points?: string } = {};
			const stageTitle = stage.title.trim();
			if (!stageTitle) problems.title = 'Give this stage a title.';
			else if (stageTitle.length > MAX_STAGE_TITLE_LENGTH)
				problems.title = `Keep it under ${MAX_STAGE_TITLE_LENGTH} characters.`;
			if (stage.hint.length > MAX_STAGE_HINT_LENGTH)
				problems.hint = `Keep it under ${MAX_STAGE_HINT_LENGTH} characters.`;
			if (!Number.isInteger(stage.points) || stage.points < 0)
				problems.points = 'Use a whole number of points, 0 or more.';
			if (problems.title || problems.hint || problems.points)
				errors.stage[stage.key] = problems;
		}
	}

	if (!Number.isInteger(draft.points) || draft.points < 0)
		errors.points = 'Choose the points for this chore.';

	if (draft.kind === 'personal' && !draft.assigneeId)
		errors.assignee = 'Choose who this chore belongs to.';

	return errors;
}

/** What the server accepts to create a chore. Trimmed, with empty values as null. */
export interface CreateChoreInput {
	title: string;
	note: string | null;
	kind: ChoreKind;
	frequency: Frequency;
	/** Weekly chores only (SB-71); the server stores null for other frequencies. */
	dueWeekday: IsoWeekday | null;
	points: number;
	assigneeId: string | null;
	stages: { title: string; hint: string | null; points: number }[];
	/** A chore this one replaces ("Duplicate as…", SB-64); archived in the same transaction as the create. */
	archiveSourceId?: string | null;
}

export function toCreateInput(draft: ChoreDraft): CreateChoreInput {
	return {
		title: draft.title.trim(),
		note: draft.note.trim() || null,
		kind: draft.kind,
		frequency: draft.frequency,
		dueWeekday: dueWeekdayFor(draft.frequency, draft.dueWeekday),
		points: draft.points,
		assigneeId: draft.kind === 'personal' ? draft.assigneeId : null,
		stages: activeStages(draft).map((s) => ({
			title: s.title.trim(),
			hint: s.hint.trim() || null,
			points: s.points,
		})),
	};
}

/**
 * Checks a request the same way the form does, for the server. Returns the
 * first problem, worded for the form, or null.
 */
export function createInputError(input: CreateChoreInput): string | null {
	if (input.kind !== 'personal' && input.kind !== 'rotation')
		return 'Choose Personal Chore or Household Rotation.';
	if (!(FREQUENCIES as readonly string[]).includes(input.frequency))
		return 'Choose Daily, Weekly, or Weekends.';
	if (input.dueWeekday != null && !isIsoWeekday(input.dueWeekday))
		return 'Choose a day of the week, or Any day.';
	if (!Array.isArray(input.stages)) return 'The stages are not valid.';
	const errors = validateDraft({
		title: String(input.title ?? ''),
		note: String(input.note ?? ''),
		kind: input.kind,
		useStages: input.stages.length > 0,
		stages: input.stages.map((s, i) => ({
			key: String(i),
			title: String(s?.title ?? ''),
			hint: String(s?.hint ?? ''),
			points: s?.points as number,
		})),
		frequency: input.frequency,
		dueWeekday: null,
		points: input.points,
		assigneeId: input.assigneeId,
	});
	return (
		errors.title ??
		errors.note ??
		errors.points ??
		errors.assignee ??
		Object.values(errors.stage)
			.map((s) => s.title ?? s.hint ?? s.points)
			.find(Boolean) ??
		null
	);
}

/** A saved chore, as the edit form loads it (SB-63). */
export interface EditableChore {
	title: string;
	description: string | null;
	type: ChoreKind;
	frequency: Frequency;
	dueWeekday: number | null;
	points: number;
	assignedMemberId: string | null;
	/** In position order. */
	stages: { id: string; title: string; hint: string | null; points: number }[];
}

/** Loads a saved chore into the draft the form edits. Each stage keeps its id as its key. */
export const choreToDraft = (chore: EditableChore): ChoreDraft => ({
	title: chore.title,
	note: chore.description ?? '',
	kind: chore.type,
	useStages: chore.stages.length > 0,
	stages: chore.stages.map((s) => ({
		key: s.id,
		id: s.id,
		title: s.title,
		hint: s.hint ?? '',
		points: s.points,
	})),
	frequency: chore.frequency,
	dueWeekday: dueWeekdayFor(chore.frequency, chore.dueWeekday),
	points: chore.points,
	assigneeId: chore.type === 'personal' ? chore.assignedMemberId : null,
});

/**
 * What the server accepts to save changes to a chore. Stages are a diff by id:
 * a stage with an `id` is updated in place, one without is new, and a saved
 * stage left out is removed. The order of the list is the new order.
 */
export interface UpdateChoreInput extends CreateChoreInput {
	choreId: string;
	/** The chore's `updated_at` when the form loaded, so a stale save is refused. */
	updatedAt: string;
	stages: {
		id: string | null;
		title: string;
		hint: string | null;
		points: number;
	}[];
}

export const toUpdateInput = (
	draft: ChoreDraft,
	choreId: string,
	updatedAt: string,
): UpdateChoreInput => ({
	...toCreateInput(draft),
	choreId,
	updatedAt,
	stages: activeStages(draft).map((s) => ({
		id: s.id ?? null,
		title: s.title.trim(),
		hint: s.hint.trim() || null,
		points: s.points,
	})),
});

/** Shown when another parent saved first. */
export const STALE_CHORE_MESSAGE =
	'This chore was changed by someone else. Reload to see their changes.';

/** Shown when a frequency change is refused because the chore is done for now (SB-65 is the proper fix). */
export const FREQUENCY_LOCKED_MESSAGE =
	'This chore is already done for this period. Change how often it repeats after it resets.';

/** The line under Rotation Preview. */
export const rotationPreviewNote =
	'Eligibility is confirmed on the next step. Anyone you exclude there drops out of this rotation.';

/** "3 stages, 15 total points", for the Eligibility panel's summary (SB-49). */
export function stagesSummary(draft: ChoreDraft): string {
	const n = activeStages(draft).length;
	const total = totalPoints(draft);
	return n === 0
		? `Single step, ${total} total points`
		: `${n} ${n === 1 ? 'stage' : 'stages'}, ${total} total points`;
}

/** The id of the Chore Setup form, so buttons outside it (the page header) can submit it. */
export const CHORE_FORM_ID = 'chore-setup-form';
