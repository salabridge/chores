-- SB-26: completing stages and chores, and reopening a completion. Hand-written
-- because drizzle-kit doesn't manage functions. See "Completions and points"
-- in ../README.md.
--
-- chore_completions and points_ledger have no insert policies for the app
-- role (0010), so these SECURITY DEFINER functions are how a completion and
-- its points get written. Each one checks who is allowed, locks the chore
-- instance (so two taps or two devices can't both award), and writes the
-- completion, the ledger row, and (for a rotation chore) the turn advance in
-- the caller's transaction: all of it commits or none of it does.
--
-- Custom SQLSTATEs raised here (mapped to errors in ../src/completions.ts):
--   CP001  the stage is locked: an earlier stage isn't done yet
--   CP002  the chore can't be completed yet: some of its stages aren't done
--   CP003  the chore has no assignee to credit
-- A rotation chore whose turn moved without this chore being completed (a
-- parent's skip) raises RT001 (from 0009).

-- Completes a chore for one period and awards its points. Idempotent: if the
-- instance already has an open completion, it returns that one with
-- `points = 0` and `already_completed = true`, and writes nothing.
--
-- Who may call it: a parent, or someone who can act as the instance's
-- assignee (themselves, or a managed kid they parent). The assignee is who
-- gets the points. A chore with stages needs every stage done first
-- (CP002). For a rotation chore the assignee is the turn-holder when the
-- period started; the turn then advances to the next eligible member, via
-- app.advance_chore_rotation, which raises RT001 if the turn has already
-- moved.
CREATE OR REPLACE FUNCTION app.complete_chore_instance(instance uuid)
	RETURNS TABLE (completion_id uuid, points integer, already_completed boolean, next_member_id uuid)
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		i public.chore_instances%ROWTYPE;
		c public.chores%ROWTYPE;
		existing uuid;
		new_completion uuid;
		stage_count integer;
		done_count integer;
		next_turn uuid;
	BEGIN
		SELECT * INTO i FROM public.chore_instances ci WHERE ci.id = instance FOR UPDATE;
		IF NOT FOUND OR NOT app.is_household_member(i.household_id) THEN
			RAISE EXCEPTION 'no chore instance %', instance USING ERRCODE = 'no_data_found';
		END IF;
		IF i.assigned_member_id IS NULL THEN
			RAISE EXCEPTION 'chore instance % has no assignee', instance USING ERRCODE = 'CP003';
		END IF;
		IF NOT (app.is_household_parent(i.household_id) OR app.can_act_as_member(i.assigned_member_id)) THEN
			RAISE EXCEPTION 'only a parent or the assignee can complete this chore'
				USING ERRCODE = 'insufficient_privilege';
		END IF;

		SELECT cc.id INTO existing
		FROM public.chore_completions cc
		WHERE cc.instance_id = instance AND cc.reopened_at IS NULL;
		IF FOUND THEN
			RETURN QUERY SELECT existing, 0, true, NULL::uuid;
			RETURN;
		END IF;

		SELECT * INTO c FROM public.chores ch WHERE ch.id = i.chore_id;

		SELECT count(*) INTO stage_count FROM public.chore_stages s WHERE s.chore_id = i.chore_id;
		SELECT count(*) INTO done_count FROM public.chore_stage_progress sp WHERE sp.instance_id = instance;
		IF done_count < stage_count THEN
			RAISE EXCEPTION 'chore % has % of % stages left', i.chore_id, stage_count - done_count, stage_count
				USING ERRCODE = 'CP002';
		END IF;

		INSERT INTO public.chore_completions (household_id, chore_id, instance_id, member_id, points)
		VALUES (i.household_id, i.chore_id, instance, i.assigned_member_id, c.points)
		RETURNING id INTO new_completion;

		IF c.points > 0 THEN
			INSERT INTO public.points_ledger (household_id, member_id, delta, reason, completion_id)
			VALUES (i.household_id, i.assigned_member_id, c.points, 'completion', new_completion);
		END IF;

		IF c.type::text = 'rotation' THEN
			SELECT a.member_id INTO next_turn
			FROM app.advance_chore_rotation(i.chore_id, i.assigned_member_id, true) a;
		END IF;

		RETURN QUERY SELECT new_completion, c.points, false, next_turn;
	END
	$$;
--> statement-breakpoint

-- Marks one stage of a chore done for a period. Stages unlock in order: an
-- earlier stage that isn't done raises CP001. Checking a stage that's already
-- done is a no-op. When it was the last stage, the chore completes in the same
-- call (complete_chore_instance), so `chore_completed` is true and the points
-- and the rotation hand-off are included. The stage is recorded for the
-- instance's assignee, same as the completion.
CREATE OR REPLACE FUNCTION app.complete_chore_stage(instance uuid, stage uuid)
	RETURNS TABLE (chore_completed boolean, completion_id uuid, points integer, already_completed boolean, next_member_id uuid)
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		i public.chore_instances%ROWTYPE;
		s public.chore_stages%ROWTYPE;
		stage_count integer;
		done_count integer;
		r record;
	BEGIN
		SELECT * INTO i FROM public.chore_instances ci WHERE ci.id = instance FOR UPDATE;
		IF NOT FOUND OR NOT app.is_household_member(i.household_id) THEN
			RAISE EXCEPTION 'no chore instance %', instance USING ERRCODE = 'no_data_found';
		END IF;
		IF i.assigned_member_id IS NULL THEN
			RAISE EXCEPTION 'chore instance % has no assignee', instance USING ERRCODE = 'CP003';
		END IF;
		IF NOT (app.is_household_parent(i.household_id) OR app.can_act_as_member(i.assigned_member_id)) THEN
			RAISE EXCEPTION 'only a parent or the assignee can complete this stage'
				USING ERRCODE = 'insufficient_privilege';
		END IF;

		SELECT * INTO s FROM public.chore_stages st WHERE st.id = stage AND st.chore_id = i.chore_id;
		IF NOT FOUND THEN
			RAISE EXCEPTION 'stage % is not a stage of chore %', stage, i.chore_id
				USING ERRCODE = 'no_data_found';
		END IF;

		IF EXISTS (
			SELECT 1 FROM public.chore_stages p
			WHERE p.chore_id = i.chore_id
				AND p.position < s.position
				AND NOT EXISTS (
					SELECT 1 FROM public.chore_stage_progress sp
					WHERE sp.instance_id = instance AND sp.stage_id = p.id
				)
		) THEN
			RAISE EXCEPTION 'an earlier stage of chore % is not done yet', i.chore_id
				USING ERRCODE = 'CP001';
		END IF;

		INSERT INTO public.chore_stage_progress (instance_id, stage_id, chore_id, household_id, completed_by_member_id)
		VALUES (instance, stage, i.chore_id, i.household_id, i.assigned_member_id)
		ON CONFLICT (instance_id, stage_id) DO NOTHING;

		SELECT count(*) INTO stage_count FROM public.chore_stages st WHERE st.chore_id = i.chore_id;
		SELECT count(*) INTO done_count FROM public.chore_stage_progress sp WHERE sp.instance_id = instance;
		IF done_count < stage_count THEN
			RETURN QUERY SELECT false, NULL::uuid, 0, false, NULL::uuid;
			RETURN;
		END IF;

		SELECT * INTO r FROM app.complete_chore_instance(instance);
		RETURN QUERY SELECT true, r.completion_id, r.points, r.already_completed, r.next_member_id;
	END
	$$;
--> statement-breakpoint

-- A parent reopens a completion (the Overview "Reopen"): the completion is
-- marked reopened, its points are taken back with a reversing ledger row (the
-- original row stays), and, for a chore with stages, the last stage is
-- unchecked so the chore is back to "Complete Chore". The instance can then be
-- completed again. Returns false when it was already reopened (a no-op).
--
-- A rotation's turn is not moved back: other members may already have had
-- their turn since.
CREATE OR REPLACE FUNCTION app.reopen_chore_completion(completion uuid)
	RETURNS boolean
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		cc public.chore_completions%ROWTYPE;
	BEGIN
		SELECT * INTO cc FROM public.chore_completions x WHERE x.id = completion FOR UPDATE;
		IF NOT FOUND OR NOT app.is_household_member(cc.household_id) THEN
			RAISE EXCEPTION 'no completion %', completion USING ERRCODE = 'no_data_found';
		END IF;
		IF NOT app.is_household_parent(cc.household_id) THEN
			RAISE EXCEPTION 'only a parent can reopen a completion'
				USING ERRCODE = 'insufficient_privilege';
		END IF;
		IF cc.reopened_at IS NOT NULL THEN
			RETURN false;
		END IF;

		UPDATE public.chore_completions x
		SET reopened_at = now(), reopened_by = app.current_user_id()
		WHERE x.id = completion;

		IF cc.member_id IS NOT NULL AND cc.points > 0 THEN
			INSERT INTO public.points_ledger (household_id, member_id, delta, reason, completion_id)
			VALUES (cc.household_id, cc.member_id, -cc.points, 'reversal', completion);
		END IF;

		DELETE FROM public.chore_stage_progress sp
		USING public.chore_stages st
		WHERE sp.instance_id = cc.instance_id
			AND sp.stage_id = st.id
			AND st.position = (
				SELECT max(s2.position) FROM public.chore_stages s2 WHERE s2.chore_id = cc.chore_id
			);

		RETURN true;
	END
	$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION
	app.complete_chore_instance(uuid),
	app.complete_chore_stage(uuid, uuid),
	app.reopen_chore_completion(uuid)
	FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
	app.complete_chore_instance(uuid),
	app.complete_chore_stage(uuid, uuid),
	app.reopen_chore_completion(uuid)
	TO authenticated_backend;
