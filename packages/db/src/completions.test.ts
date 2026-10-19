import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthenticatedTx } from './authenticated-db.ts';
import {
	ChoreDoerNotInHouseholdError,
	ChoreNotAssignedError,
	ChoreStagesIncompleteError,
	completeChore,
	completeChoreStage,
	mapCompletionError,
	StageLockedError,
	weeklyGoalProgress,
} from './completions.ts';

const INSTANCE = '00000000-0000-4000-8000-000000000001';
const STAGE = '00000000-0000-4000-8000-000000000002';
const MIA = '00000000-0000-4000-8000-000000000003';
const LEO = '00000000-0000-4000-8000-000000000004';
const COMPLETION = '00000000-0000-4000-8000-000000000005';

/** A tx that records each statement and answers with `rows` (or throws `error`). */
function fakeTx(result: { rows?: unknown[]; error?: unknown }) {
	const dialect = new PgDialect();
	const queries: { sql: string; params: unknown[] }[] = [];
	const tx = {
		execute: async (query: SQL) => {
			queries.push(dialect.sqlToQuery(query));
			if (result.error) throw result.error;
			return { rows: result.rows ?? [] };
		},
	} as unknown as AuthenticatedTx;
	return { tx, queries };
}

const pgError = (code: string) =>
	Object.assign(new Error(`pg ${code}`), { code });

test('completeChore passes no doer by default, so the assignee is credited', async () => {
	const { tx, queries } = fakeTx({
		rows: [
			{
				completion_id: COMPLETION,
				points: 10,
				already_completed: false,
				next_member_id: null,
				credited_member_id: LEO,
			},
		],
	});
	const result = await completeChore(tx, INSTANCE);
	assert.deepEqual(result, {
		completionId: COMPLETION,
		points: 10,
		alreadyCompleted: false,
		nextMemberId: null,
		creditedMemberId: LEO,
	});
	assert.match(
		queries[0].sql,
		/app\.complete_chore_instance\(\$1::uuid, \$2::uuid\)/,
	);
	assert.deepEqual(queries[0].params, [INSTANCE, null]);
});

test('completeChore passes doneBy through and reports who was credited', async () => {
	const { tx, queries } = fakeTx({
		rows: [
			{
				completion_id: COMPLETION,
				points: 10,
				already_completed: false,
				next_member_id: null,
				credited_member_id: MIA,
			},
		],
	});
	const result = await completeChore(tx, INSTANCE, { doneBy: MIA });
	assert.equal(result.creditedMemberId, MIA);
	assert.deepEqual(queries[0].params, [INSTANCE, MIA]);
});

test('completeChoreStage passes doneBy through', async () => {
	const { tx, queries } = fakeTx({
		rows: [
			{
				chore_completed: true,
				completion_id: COMPLETION,
				points: 15,
				already_completed: false,
				next_member_id: null,
				credited_member_id: MIA,
			},
		],
	});
	const result = await completeChoreStage(tx, INSTANCE, STAGE, { doneBy: MIA });
	assert.deepEqual(result, {
		choreCompleted: true,
		completionId: COMPLETION,
		points: 15,
		alreadyCompleted: false,
		nextMemberId: null,
		creditedMemberId: MIA,
	});
	assert.match(
		queries[0].sql,
		/app\.complete_chore_stage\(\$1::uuid, \$2::uuid, \$3::uuid\)/,
	);
	assert.deepEqual(queries[0].params, [INSTANCE, STAGE, MIA]);
});

test('a stage that does not finish the chore reports choreCompleted false', async () => {
	const { tx } = fakeTx({
		rows: [
			{
				chore_completed: false,
				completion_id: null,
				points: 0,
				already_completed: false,
				next_member_id: null,
				credited_member_id: null,
			},
		],
	});
	assert.deepEqual(await completeChoreStage(tx, INSTANCE, STAGE), {
		choreCompleted: false,
	});
});

test('a doer from another household maps to ChoreDoerNotInHouseholdError', async () => {
	const { tx } = fakeTx({
		error: Object.assign(new Error('wrapped'), { cause: pgError('CP004') }),
	});
	await assert.rejects(completeChore(tx, INSTANCE, { doneBy: MIA }), (err) => {
		assert.ok(err instanceof ChoreDoerNotInHouseholdError);
		assert.equal(err.instanceId, INSTANCE);
		assert.equal(err.doneBy, MIA);
		return true;
	});
});

test('mapCompletionError maps every completion SQLSTATE and passes others through', () => {
	assert.ok(
		mapCompletionError(pgError('CP001'), INSTANCE, STAGE) instanceof
			StageLockedError,
	);
	assert.ok(
		mapCompletionError(pgError('CP002'), INSTANCE) instanceof
			ChoreStagesIncompleteError,
	);
	assert.ok(
		mapCompletionError(pgError('CP003'), INSTANCE) instanceof
			ChoreNotAssignedError,
	);
	assert.ok(
		mapCompletionError(pgError('CP004'), INSTANCE, undefined, MIA) instanceof
			ChoreDoerNotInHouseholdError,
	);
	const denied = pgError('42501');
	assert.equal(mapCompletionError(denied, INSTANCE), denied);
});

test('progress toward the goal', () => {
	assert.deepEqual(weeklyGoalProgress(160, 200), {
		earned: 160,
		goal: 200,
		remaining: 40,
		percent: 80,
		reached: false,
	});
});

test('reaching or passing the goal caps the bar at 100%', () => {
	assert.deepEqual(weeklyGoalProgress(250, 200), {
		earned: 250,
		goal: 200,
		remaining: 0,
		percent: 100,
		reached: true,
	});
});

test('percent rounds down so 100% only shows once the goal is reached', () => {
	assert.equal(weeklyGoalProgress(199, 200).percent, 99);
});

test('a net-negative week (reversals) counts as 0 earned', () => {
	const p = weeklyGoalProgress(-10, 200);
	assert.equal(p.earned, 0);
	assert.equal(p.remaining, 200);
	assert.equal(p.percent, 0);
});

test('a goal of 0 is always reached', () => {
	const p = weeklyGoalProgress(0, 0);
	assert.equal(p.reached, true);
	assert.equal(p.percent, 100);
});
