CREATE TYPE "public"."points_adjustment_kind" AS ENUM('gift', 'carry_over', 'transfer');--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "gifts_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD COLUMN "adjustment_kind" "points_adjustment_kind";--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_adjustment_kind_check" CHECK (("points_ledger"."adjustment_kind" is null or "points_ledger"."reason" = 'adjustment')
				and ("points_ledger"."adjustment_kind" is distinct from 'gift' or "points_ledger"."delta" > 0));--> statement-breakpoint
ALTER POLICY "points_ledger_insert" ON "points_ledger" TO authenticated_backend WITH CHECK (app.is_household_parent("points_ledger"."household_id")
				and "points_ledger"."reason" = 'adjustment'
				and ("points_ledger"."adjustment_kind" is null or "points_ledger"."adjustment_kind" = 'gift')
				and "points_ledger"."created_by" = (select app.current_user_id()));--> statement-breakpoint

-- SB-83, hand-written from here: the backfill, the merge and member removal
-- writing their markers, and app.mark_gifts_seen. (Numbered 0027: it was 0025
-- in parallel with SB-84's 0026, and has to run after it, since 0026 replaces
-- both functions.)
--
-- Backfill `adjustment_kind` from the notes the old code relied on. The merge
-- (SB-76) wrote "Carried over from …"; removing a member (SB-84) writes
-- "Moved from …". Every other positive adjustment was a parent's gift (SB-78):
-- the gift form was the only other thing writing adjustments.
UPDATE points_ledger SET adjustment_kind = 'carry_over'
	WHERE reason = 'adjustment' AND note LIKE 'Carried over from %';
--> statement-breakpoint
UPDATE points_ledger SET adjustment_kind = 'transfer'
	WHERE reason = 'adjustment' AND note LIKE 'Moved from %';
--> statement-breakpoint
UPDATE points_ledger SET adjustment_kind = 'gift'
	WHERE reason = 'adjustment' AND adjustment_kind IS NULL AND delta > 0;
--> statement-breakpoint

-- The merge (as in 0026) marks its carry-over rows. Unchanged apart from that.
CREATE OR REPLACE FUNCTION app.merge_household_via_invite(token text, confirm_household_id uuid)
	RETURNS uuid
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		uid uuid := app.current_user_id();
		inv public.household_invites%ROWTYPE;
		old_name text;
		kid_count bigint;
		m record;
		new_role public.household_role;
		new_member uuid;
		caller_member uuid;
	BEGIN
		inv := app.claim_open_invite(token);

		IF confirm_household_id = inv.household_id THEN
			RAISE EXCEPTION 'that is the household the invite is for'
				USING ERRCODE = '22023', HINT = 'same-household';
		END IF;

		-- Checked once without locks, so a caller can't lock a household row
		-- they don't own just by naming it; checked again below under the lock.
		IF NOT EXISTS (
			SELECT 1 FROM public.household_members hm
			WHERE hm.household_id = confirm_household_id AND hm.user_id = uid AND hm.role = 'owner'
		) THEN
			RAISE EXCEPTION 'only an owner of the household can move it'
				USING ERRCODE = '42501', HINT = 'not-owner';
		END IF;

		PERFORM pg_advisory_xact_lock(hashtext('accept_household_invite:' || uid::text));
		PERFORM 1 FROM public.households h
		WHERE h.id IN (inv.household_id, confirm_household_id)
		ORDER BY h.id
		FOR UPDATE;

		SELECT h.name INTO old_name
		FROM public.households h
		JOIN public.household_members hm ON hm.household_id = h.id
		WHERE h.id = confirm_household_id AND hm.user_id = uid AND hm.role = 'owner';
		IF NOT FOUND THEN
			RAISE EXCEPTION 'only an owner of the household can move it'
				USING ERRCODE = '42501', HINT = 'not-owner';
		END IF;

		IF EXISTS (
			SELECT 1 FROM public.household_members hm
			WHERE hm.user_id = uid AND hm.household_id <> confirm_household_id
		) THEN
			RAISE EXCEPTION 'already in another household'
				USING ERRCODE = 'P0001', HINT = 'already-in-household';
		END IF;

		-- The 12-kid cap (as in accept_household_invite) on the combined
		-- household: the target's kids plus everyone who moves in as a kid
		-- (see new_role below: with a kid invite, that's everyone).
		SELECT count(*) INTO kid_count
		FROM public.household_members hm
		WHERE hm.removed_at IS NULL
			AND ((hm.household_id = inv.household_id AND hm.role = 'kid')
			OR (
				hm.household_id = confirm_household_id
				AND (hm.role = 'kid' OR inv.role = 'kid')
				AND NOT EXISTS (
					SELECT 1 FROM public.household_members t
					WHERE t.household_id = inv.household_id AND t.user_id = hm.user_id
				)
			));
		IF kid_count > 12 THEN
			RAISE EXCEPTION 'household is full'
				USING ERRCODE = 'P0001', HINT = 'household-full';
		END IF;

		FOR m IN
			SELECT hm.*,
				(SELECT coalesce(sum(l.delta), 0) FROM public.points_ledger l
				 WHERE l.member_id = hm.id AND l.household_id = hm.household_id) AS balance
			FROM public.household_members hm
			WHERE hm.household_id = confirm_household_id AND hm.removed_at IS NULL
			ORDER BY hm.joined_at, hm.id
		LOOP
			IF m.user_id IS NOT NULL AND EXISTS (
				SELECT 1 FROM public.household_members t
				WHERE t.household_id = inv.household_id AND t.user_id = m.user_id
			) THEN
				CONTINUE;
			END IF;

			-- Nobody moves in above the invite's role: the invite is the target's
			-- only approval, so a kid invite can't bring parents along.
			new_role := CASE
				WHEN m.user_id = uid THEN inv.role
				WHEN inv.role = 'kid' THEN 'kid'::public.household_role
				WHEN m.role IN ('owner', 'parent') THEN 'parent'::public.household_role
				ELSE 'kid'::public.household_role
			END;

			INSERT INTO public.household_members (
				household_id, user_id, role, display_name, avatar_color, avatar_initial,
				birth_year, weekly_goal_points
			)
			VALUES (
				inv.household_id, m.user_id, new_role, m.display_name, m.avatar_color,
				m.avatar_initial, m.birth_year, m.weekly_goal_points
			)
			RETURNING id INTO new_member;

			IF m.user_id = uid THEN
				caller_member := new_member;
			END IF;

			IF new_role <> 'kid' THEN
				INSERT INTO public.household_member_pins (
					member_id, pin_hash, failed_attempts, last_failed_at, locked_at
				)
				SELECT new_member, p.pin_hash, p.failed_attempts, p.last_failed_at, p.locked_at
				FROM public.household_member_pins p
				WHERE p.member_id = m.id;
			END IF;

			IF m.balance <> 0 THEN
				INSERT INTO public.points_ledger (
					household_id, member_id, delta, reason, adjustment_kind, note, created_by
				)
				VALUES (
					inv.household_id, new_member,
					greatest(least(m.balance, 2147483647), -2147483648)::integer, 'adjustment',
					'carry_over', left('Carried over from ' || old_name, 200), uid
				);
			END IF;
		END LOOP;

		UPDATE public.household_invites
		SET accepted_at = now(), accepted_member_id = caller_member
		WHERE id = inv.id;

		DELETE FROM public.chore_completions cc WHERE cc.household_id = confirm_household_id;
		DELETE FROM public.reward_claims rc WHERE rc.household_id = confirm_household_id;
		DELETE FROM public.households h WHERE h.id = confirm_household_id;

		RETURN caller_member;
	END
	$$;
--> statement-breakpoint

-- Removing a member (as in 0026) marks its moved points. Unchanged apart from
-- that; CREATE OR REPLACE keeps its grant.
CREATE OR REPLACE FUNCTION app.remove_household_member(
	member uuid,
	move_points_to uuid DEFAULT NULL,
	acting_as uuid DEFAULT NULL
) RETURNS integer
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		uid uuid := app.current_user_id();
		target public.household_members%ROWTYPE;
		actor public.household_members%ROWTYPE;
		recipient public.household_members%ROWTYPE;
		hh_timezone text;
		today date;
		balance bigint;
		moved integer := 0;
	BEGIN
		IF uid IS NULL THEN
			RAISE EXCEPTION 'not signed in'
				USING ERRCODE = '42501', HINT = 'not-signed-in';
		END IF;

		-- Unlocked: is the caller in the member's household at all?
		SELECT * INTO target FROM public.household_members m
		WHERE m.id = member AND m.removed_at IS NULL;
		IF NOT FOUND OR NOT app.is_household_member(target.household_id) THEN
			RAISE EXCEPTION 'member not found'
				USING ERRCODE = 'P0002', HINT = 'member-not-found';
		END IF;
		IF NOT app.is_household_parent(target.household_id) THEN
			RAISE EXCEPTION 'only a parent can remove a member'
				USING ERRCODE = '42501', HINT = 'not-parent';
		END IF;

		SELECT h.timezone INTO hh_timezone FROM public.households h
		WHERE h.id = target.household_id
		FOR UPDATE;

		-- Again under the locks: the member and the caller as they are now.
		SELECT * INTO target FROM public.household_members m
		WHERE m.id = member AND m.removed_at IS NULL
		FOR UPDATE;
		IF NOT FOUND THEN
			RAISE EXCEPTION 'member not found'
				USING ERRCODE = 'P0002', HINT = 'member-not-found';
		END IF;
		SELECT * INTO actor FROM public.household_members m
		WHERE m.household_id = target.household_id AND m.user_id = uid
			AND m.removed_at IS NULL;
		IF NOT FOUND OR actor.role NOT IN ('owner', 'parent') THEN
			RAISE EXCEPTION 'only a parent can remove a member'
				USING ERRCODE = '42501', HINT = 'not-parent';
		END IF;
		IF acting_as IS NOT NULL AND acting_as <> actor.id THEN
			RAISE EXCEPTION 'leave the kid profile to remove a member'
				USING ERRCODE = '42501', HINT = 'kid-profile';
		END IF;
		IF target.id = actor.id THEN
			RAISE EXCEPTION 'you can''t remove yourself'
				USING ERRCODE = '22023', HINT = 'self';
		END IF;
		IF target.role <> 'kid' AND actor.role <> 'owner' THEN
			RAISE EXCEPTION 'only an owner can remove a parent'
				USING ERRCODE = '42501', HINT = 'not-owner';
		END IF;
		IF target.role = 'owner' AND NOT EXISTS (
			SELECT 1 FROM public.household_members o
			WHERE o.household_id = target.household_id AND o.role = 'owner'
				AND o.removed_at IS NULL AND o.id <> target.id
		) THEN
			RAISE EXCEPTION 'the household''s only owner can''t be removed'
				USING ERRCODE = '22023', HINT = 'last-owner';
		END IF;

		IF move_points_to IS NOT NULL THEN
			SELECT * INTO recipient FROM public.household_members m
			WHERE m.id = move_points_to AND m.household_id = target.household_id
				AND m.removed_at IS NULL AND m.role = 'kid' AND m.id <> target.id;
			IF NOT FOUND OR target.role <> 'kid' THEN
				RAISE EXCEPTION 'points can only move from a kid to another kid in the household'
					USING ERRCODE = '22023', HINT = 'invalid-recipient';
			END IF;

			SELECT coalesce(sum(l.delta), 0) INTO balance FROM public.points_ledger l
			WHERE l.member_id = target.id AND l.household_id = target.household_id;
			moved := greatest(least(balance, 2147483647), -2147483648)::integer;
			IF moved <> 0 THEN
				-- `transfer`, so the web app's bonus-points list leaves them out
				-- (it isn't a gift).
				INSERT INTO public.points_ledger (
					household_id, member_id, delta, reason, adjustment_kind, note, created_by
				)
				VALUES
					(target.household_id, target.id, -moved, 'adjustment', 'transfer',
					 left('Moved from ' || target.display_name || ' to ' || recipient.display_name || ' (duplicate profile)', 200),
					 uid),
					(target.household_id, recipient.id, moved, 'adjustment', 'transfer',
					 left('Moved from ' || target.display_name || ' (duplicate profile)', 200),
					 uid);
			END IF;
		END IF;

		-- Pending favours involving them: lock the instances, then decline.
		PERFORM 1 FROM public.chore_instances ci
		WHERE ci.id IN (
			SELECT cc.instance_id FROM public.chore_completions cc
			WHERE cc.household_id = target.household_id
				AND cc.approval_status = 'pending'
				AND (cc.member_id = target.id OR cc.done_by_member_id = target.id)
		)
		ORDER BY ci.id
		FOR UPDATE;
		DELETE FROM public.chore_stage_progress sp
		USING public.chore_completions cc
		WHERE cc.household_id = target.household_id
			AND cc.approval_status = 'pending'
			AND (cc.member_id = target.id OR cc.done_by_member_id = target.id)
			AND sp.instance_id = cc.instance_id
			AND sp.completed_by_member_id IS NOT DISTINCT FROM cc.done_by_member_id;
		UPDATE public.chore_completions cc
		SET approval_status = 'declined', decided_by_member_id = actor.id, decided_at = now()
		WHERE cc.household_id = target.household_id
			AND cc.approval_status = 'pending'
			AND (cc.member_id = target.id OR cc.done_by_member_id = target.id);

		-- Out of every rotation; the 0009 trigger hands their turn on.
		DELETE FROM public.chore_rotation_members rm
		WHERE rm.member_id = target.id AND rm.household_id = target.household_id;

		UPDATE public.chores c
		SET assigned_member_id = NULL, updated_at = now()
		WHERE c.household_id = target.household_id AND c.assigned_member_id = target.id;

		-- Their open instances from today on: the rotation's turn now, or nobody.
		today := (now() AT TIME ZONE hh_timezone)::date;
		PERFORM 1 FROM public.chore_instances ci
		WHERE ci.household_id = target.household_id AND ci.assigned_member_id = target.id
		ORDER BY ci.id
		FOR UPDATE;
		UPDATE public.chore_instances ci
		SET assigned_member_id = (
				SELECT r.current_member_id FROM public.chore_rotations r
				WHERE r.chore_id = ci.chore_id
			)
		FROM public.chores c
		WHERE c.id = ci.chore_id
			AND ci.household_id = target.household_id
			AND ci.assigned_member_id = target.id
			-- A weekly period starts on Monday, so this week's is at most 6 days back.
			AND ci.period_start >= CASE WHEN c.frequency = 'weekly' THEN today - 6 ELSE today END
			AND NOT EXISTS (
				SELECT 1 FROM public.chore_completions cc
				WHERE cc.instance_id = ci.id
					AND cc.reopened_at IS NULL
					AND cc.approval_status <> 'declined'
			);

		UPDATE public.chore_reminders cr
		SET dismissed_at = now()
		WHERE cr.household_id = target.household_id
			AND cr.assignee_member_id = target.id
			AND cr.dismissed_at IS NULL;

		IF target.user_id IS NOT NULL THEN
			DELETE FROM public.household_invites i
			WHERE i.household_id = target.household_id
				AND i.invited_by = target.user_id
				AND i.accepted_at IS NULL;
			UPDATE public.device_profiles d
			SET active_member_id = NULL
			WHERE d.user_id = target.user_id AND d.active_member_id IS NOT NULL;
		END IF;
		UPDATE public.device_profiles d
		SET active_member_id = NULL
		WHERE d.active_member_id = target.id;
		DELETE FROM public.household_member_pins p WHERE p.member_id = target.id;

		UPDATE public.household_members m
		SET removed_at = now(), user_id = NULL, updated_at = now()
		WHERE m.id = target.id;

		RETURN moved;
	END
	$$;
--> statement-breakpoint

-- Marks gifts as seen once the kid dismisses the "You got bonus points!"
-- moment. `gift_ids` are the gifts the moment showed; the member's
-- `gifts_seen_at` moves forward to the newest of them, never back. Passing
-- the shown ids (rather than "now") means a gift that arrives while the moment
-- is open stays unseen. Ids that aren't this member's gifts are ignored.
--
-- Only for a kid, and only by someone who can act as them
-- (app.can_act_as_member): the kid's own login, or a parent of a managed kid
-- (the shared device on the kid's profile). Never a parent for a kid with
-- their own login, for another parent or for themselves. The column has no
-- UPDATE grant, so this is the only way to change it.
-- Returns the new `gifts_seen_at` (NULL if nothing has been seen yet).
CREATE OR REPLACE FUNCTION app.mark_gifts_seen(member_id uuid, gift_ids uuid[])
	RETURNS timestamptz
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		uid uuid := app.current_user_id();
		newest timestamptz;
		seen timestamptz;
	BEGIN
		IF uid IS NULL THEN
			RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
		END IF;

		-- Locks the row, so two devices dismissing at once take turns.
		PERFORM 1 FROM public.household_members hm
			WHERE hm.id = mark_gifts_seen.member_id
				AND hm.role = 'kid'
				AND app.can_act_as_member(hm.id)
			FOR UPDATE;
		IF NOT FOUND THEN
			RAISE EXCEPTION 'only the kid (or a parent on their profile) can mark their gifts as seen'
				USING ERRCODE = '42501';
		END IF;

		SELECT max(pl.created_at) INTO newest
		FROM public.points_ledger pl
		WHERE pl.id = ANY (gift_ids)
			AND pl.member_id = mark_gifts_seen.member_id
			AND pl.reason = 'adjustment'
			AND pl.adjustment_kind = 'gift';

		UPDATE public.household_members hm
		SET gifts_seen_at = greatest(hm.gifts_seen_at, newest)
		WHERE hm.id = mark_gifts_seen.member_id
		RETURNING hm.gifts_seen_at INTO seen;

		RETURN seen;
	END
	$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.mark_gifts_seen(uuid, uuid[]) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.mark_gifts_seen(uuid, uuid[]) TO authenticated_backend;
