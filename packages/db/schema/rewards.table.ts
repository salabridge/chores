import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { households } from './households.table.ts';
import { rewardClaims } from './reward-claims.table.ts';
import { rewardKind } from './reward-kind.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdMember,
	isHouseholdParent,
} from './rls.ts';

/**
 * The household's reward catalog (SB-27): things a parent offers in exchange
 * for points. Members read it; parents create, edit and delete.
 *
 * `cost_points` means different things per `kind`: a personal reward costs that
 * many of the member's own points (spent on claim), while a family milestone
 * unlocks once the household has earned that many points this week. See
 * `rewardStatuses()` in ../src/rewards.ts for how "Earned", "Claimed" and
 * "Next up" are derived.
 *
 * Non-repeatable personal rewards can be claimed once per member (enforced
 * when claiming, see `reward_claims`). Family milestones are never repeatable.
 */
export const rewards = pgTable(
	'rewards',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		/** Points to spend (personal) or the household weekly total to reach (milestone). */
		costPoints: integer('cost_points').notNull(),
		kind: rewardKind('kind').notNull().default('personal'),
		/** Whether the same member can claim it more than once. */
		repeatable: boolean('repeatable').notNull().default(false),
		/** The auth user who created the reward (an audit field, not a member reference). */
		createdBy: uuid('created_by')
			.default(sql`app.current_user_id()`)
			.references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		// Lets reward_claims reference (reward, household) together.
		unique('rewards_id_household_id_key').on(t.id, t.householdId),
		index('rewards_household_id_idx').on(t.householdId),
		check(
			'rewards_title_check',
			sql`char_length(btrim(${t.title})) between 1 and 100`,
		),
		check(
			'rewards_description_check',
			sql`${t.description} is null or char_length(${t.description}) <= 500`,
		),
		// A zero-cost reward couldn't write a ledger row (deltas are never 0).
		check(
			'rewards_cost_points_check',
			sql`${t.costPoints} between 1 and 100000`,
		),
		check(
			'rewards_milestone_not_repeatable_check',
			sql`${t.kind} = 'personal' or not ${t.repeatable}`,
		),
		pgPolicy('rewards_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		pgPolicy('rewards_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${t.createdBy} = ${currentUserId}`,
		}),
		pgPolicy('rewards_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('rewards_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
	],
);

export const rewardsRelations = relations(rewards, ({ one, many }) => ({
	household: one(households, {
		fields: [rewards.householdId],
		references: [households.id],
	}),
	claims: many(rewardClaims),
}));
