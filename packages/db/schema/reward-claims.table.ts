import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	foreignKey,
	index,
	integer,
	pgPolicy,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import { rewards } from './rewards.table.ts';
import { backendRole, isHouseholdMember } from './rls.ts';

/**
 * A member spending points on a personal reward (SB-27). Each claim has a
 * matching negative `points_ledger` row (`reason = 'reward_claim'`,
 * `reward_claim_id` pointing back here), written in the same statement.
 *
 * `cost_points` is copied from the reward so later price edits don't rewrite
 * history. `single_use` is copied from `NOT rewards.repeatable`; a partial
 * unique index on it is what stops a non-repeatable reward being claimed twice
 * by the same member, even when two taps race.
 *
 * Nothing writes this table through the app role: claims go through
 * `claimReward()` in the web app's server code, which checks the balance and
 * the claim limit.
 */
export const rewardClaims = pgTable(
	'reward_claims',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		rewardId: uuid('reward_id').notNull(),
		/** Who claimed it. Leaving the household removes the member's claims. */
		memberId: uuid('member_id').notNull(),
		/** Points spent, copied from `rewards.cost_points` at claim time. */
		costPoints: integer('cost_points').notNull(),
		/** True when the reward was non-repeatable at claim time. */
		singleUse: boolean('single_use').notNull(),
		claimedAt: timestamp('claimed_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		foreignKey({
			name: 'reward_claims_reward_fk',
			columns: [t.rewardId, t.householdId],
			foreignColumns: [rewards.id, rewards.householdId],
		}).onDelete('cascade'),
		foreignKey({
			name: 'reward_claims_member_fk',
			columns: [t.memberId, t.householdId],
			foreignColumns: [householdMembers.id, householdMembers.householdId],
		}).onDelete('cascade'),
		// A non-repeatable reward is claimed at most once per member.
		uniqueIndex('reward_claims_reward_id_member_id_single_use_key')
			.on(t.rewardId, t.memberId)
			.where(sql`${t.singleUse}`),
		index('reward_claims_member_id_claimed_at_idx').on(t.memberId, t.claimedAt),
		index('reward_claims_household_id_idx').on(t.householdId),
		pgPolicy('reward_claims_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// No insert/update/delete policies: claims are written by claimReward().
	],
);

export const rewardClaimsRelations = relations(rewardClaims, ({ one }) => ({
	household: one(households, {
		fields: [rewardClaims.householdId],
		references: [households.id],
	}),
	reward: one(rewards, {
		fields: [rewardClaims.rewardId],
		references: [rewards.id],
	}),
	member: one(householdMembers, {
		fields: [rewardClaims.memberId],
		references: [householdMembers.id],
	}),
}));
