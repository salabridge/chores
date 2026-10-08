// What the Chore Creator (SB-48) edits, as plain data shared by the form, the
// remote function, and the tests. No server imports: this is bundled into the
// client, and the same validation runs again on the server.

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
	title: string;
	hint: string;
}

/**
 * The chore as the parent is filling it in. Stages carry no points of their
 * own: the chore's points are the source of truth and are awarded once, after
 * the last stage.
 */
export interface ChoreDraft {
	title: string;
	note: string;
	/** Personal chore / Assign Individual vs Household Rotation (one choice, shown twice). */
	kind: ChoreKind;
	useStages: boolean;
	stages: StageDraft[];
	frequency: Frequency;
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
});

export const emptyDraft = (kind: ChoreKind = 'personal'): ChoreDraft => ({
	title: '',
	note: '',
	kind,
	useStages: false,
	stages: [],
	frequency: 'daily',
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
		},
		{
			key: newStageKey(),
			title: 'Wipe the sink and mirror',
			hint: 'Use the blue cloth and spray under the cabinet.',
		},
		{
			key: newStageKey(),
			title: 'Clean the toilet and sweep',
			hint: 'Gloves are under the sink.',
		},
	],
	frequency: 'daily',
	points: 15,
	assigneeId: null,
});

export const frequencyLabel = (frequency: Frequency) =>
	({ daily: 'Daily', weekly: 'Weekly', weekends: 'Weekends' })[frequency];

/** The green badge on step 4: "Daily • 15 pts". */
export const frequencySummary = (
	draft: Pick<ChoreDraft, 'frequency' | 'points'>,
) => `${frequencyLabel(draft.frequency)} • ${draft.points} pts`;

/** The grey hint under the points chips. */
export function pointsHint(draft: Pick<ChoreDraft, 'frequency' | 'useStages'>) {
	const tail = draft.useStages
		? 'The points are awarded once, after the last stage.'
		: 'You can adjust this later.';
	return `${frequencyLabel(draft.frequency)} chores usually land between 5 and 20 points. ${tail}`;
}

/** The stage rows that count: only while stages are on. */
export const activeStages = (
	draft: Pick<ChoreDraft, 'useStages' | 'stages'>,
) => (draft.useStages ? draft.stages : []);

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
	stage: Record<string, { title?: string; hint?: string }>;
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
			const problems: { title?: string; hint?: string } = {};
			const stageTitle = stage.title.trim();
			if (!stageTitle) problems.title = 'Give this stage a title.';
			else if (stageTitle.length > MAX_STAGE_TITLE_LENGTH)
				problems.title = `Keep it under ${MAX_STAGE_TITLE_LENGTH} characters.`;
			if (stage.hint.length > MAX_STAGE_HINT_LENGTH)
				problems.hint = `Keep it under ${MAX_STAGE_HINT_LENGTH} characters.`;
			if (problems.title || problems.hint) errors.stage[stage.key] = problems;
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
	points: number;
	assigneeId: string | null;
	stages: { title: string; hint: string | null }[];
}

export function toCreateInput(draft: ChoreDraft): CreateChoreInput {
	return {
		title: draft.title.trim(),
		note: draft.note.trim() || null,
		kind: draft.kind,
		frequency: draft.frequency,
		points: draft.points,
		assigneeId: draft.kind === 'personal' ? draft.assigneeId : null,
		stages: activeStages(draft).map((s) => ({
			title: s.title.trim(),
			hint: s.hint.trim() || null,
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
		})),
		frequency: input.frequency,
		points: input.points,
		assigneeId: input.assigneeId,
	});
	return (
		errors.title ??
		errors.note ??
		errors.points ??
		errors.assignee ??
		Object.values(errors.stage)
			.map((s) => s.title ?? s.hint)
			.find(Boolean) ??
		null
	);
}

/** The line under Rotation Preview. */
export const rotationPreviewNote =
	'Eligibility is confirmed on the next step. Anyone you exclude there drops out of this rotation.';

/** "3 stages, 15 total points", for the Eligibility panel's summary (SB-49). */
export function stagesSummary(draft: ChoreDraft): string {
	const n = activeStages(draft).length;
	return n === 0
		? `Single step, ${draft.points} total points`
		: `${n} ${n === 1 ? 'stage' : 'stages'}, ${draft.points} total points`;
}

/** The id of the Chore Setup form, so buttons outside it (the page header) can submit it. */
export const CHORE_FORM_ID = 'chore-setup-form';
