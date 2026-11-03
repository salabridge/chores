ALTER TABLE "points_ledger" ADD COLUMN "stage_instance_id" uuid;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_stage_instance_id_chore_instances_id_fk" FOREIGN KEY ("stage_instance_id") REFERENCES "public"."chore_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_stage_id_chore_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."chore_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "points_ledger_stage_idx" ON "points_ledger" USING btree ("stage_instance_id","stage_id");--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_stage_source_check" CHECK (("points_ledger"."stage_id" is null and "points_ledger"."stage_instance_id" is null)
				or ("points_ledger"."completion_id" is null
					and "points_ledger"."reason" in ('completion', 'reversal')));
--> statement-breakpoint

-- Per-stage points (PoC). A stage's own `chore_stages.points` is paid out when
-- the stage is checked off, on top of the chore's own points, which are still
-- paid once when the last stage finishes the chore.
--
-- A stage's award is an ordinary `completion` ledger row that names its stage
-- and instance (`stage_id`, `stage_instance_id`) instead of a completion.
-- Taking it back is a `reversal` row for whatever is still outstanding on that
-- stage, so the ledger stays append-only and the balance is still sum(delta).
--
-- - app.complete_chore_stage pays the stage straight away, except for a
--   favour: those wait for app.decide_favour, which pays every stage the doer
--   did when it approves, together with the chore's points.
-- - Un-checking a stage (a reopened completion's last stage, a declined
--   favour, anything that deletes the progress row) takes its points back
--   through the trigger below. Deleting the chore, its stage, or the instance
--   does not: the points stay, only the ledger's links to them go.
--
-- Idempotent by net: a stage is paid only while its ledger rows sum to 0, and
-- reversed only while they sum to more than 0, so repeating a call (or editing
-- the stage's points after it was paid) never pays or takes back twice.
--> statement-breakpoint

-- Pays the stage's points to whoever checked it off, once. Returns the points
-- paid now (0 if the stage is worth nothing, isn't done, was already paid, or
-- its doer has left the household). Internal: the caller holds the instance
-- lock and has already decided the stage may pay.
CREATE FUNCTION app.award_stage_points(instance uuid, stage uuid)
	RETURNS integer
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		sp public.chore_stage_progress%ROWTYPE;
		worth integer;
		net integer;
	BEGIN
		SELECT * INTO sp FROM public.chore_stage_progress p
		WHERE p.instance_id = instance AND p.stage_id = stage;
		IF NOT FOUND OR sp.completed_by_member_id IS NULL THEN
			RETURN 0;
		END IF;

		SELECT st.points INTO worth FROM public.chore_stages st WHERE st.id = stage;
		IF worth IS NULL OR worth <= 0 THEN
			RETURN 0;
		END IF;

		SELECT coalesce(sum(pl.delta), 0) INTO net
		FROM public.points_ledger pl
		WHERE pl.stage_instance_id = instance AND pl.stage_id = stage;
		IF net > 0 THEN
			RETURN 0;
		END IF;

		INSERT INTO public.points_ledger (household_id, member_id, delta, reason, stage_instance_id, stage_id)
		VALUES (sp.household_id, sp.completed_by_member_id, worth, 'completion', instance, stage);
		RETURN worth;
	END
	$$;
--> statement-breakpoint

-- Takes back what is still outstanding on a stage, from whoever it was paid
-- to. Returns the points taken back.
CREATE FUNCTION app.reverse_stage_points(instance uuid, stage uuid)
	RETURNS integer
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		paid record;
		taken integer := 0;
	BEGIN
		FOR paid IN
			SELECT pl.household_id, pl.member_id, sum(pl.delta)::integer AS net
			FROM public.points_ledger pl
			WHERE pl.stage_instance_id = instance AND pl.stage_id = stage
			GROUP BY pl.household_id, pl.member_id
			HAVING sum(pl.delta) > 0
		LOOP
			INSERT INTO public.points_ledger (household_id, member_id, delta, reason, stage_instance_id, stage_id)
			VALUES (paid.household_id, paid.member_id, -paid.net, 'reversal', instance, stage);
			taken := taken + paid.net;
		END LOOP;
		RETURN taken;
	END
	$$;
--> statement-breakpoint

-- Runs after a stage's progress row is deleted. A cascade from deleting the
-- chore, the stage or the instance finds its parent already gone and leaves
-- the points alone.
CREATE FUNCTION app.chore_stage_progress_take_back_points()
	RETURNS trigger
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		IF EXISTS (SELECT 1 FROM public.chore_stages st WHERE st.id = OLD.stage_id)
			AND EXISTS (SELECT 1 FROM public.chore_instances ci WHERE ci.id = OLD.instance_id)
		THEN
			PERFORM app.reverse_stage_points(OLD.instance_id, OLD.stage_id);
		END IF;
		RETURN NULL;
	END
	$$;
--> statement-breakpoint
CREATE TRIGGER chore_stage_progress_take_back_points
	AFTER DELETE ON public.chore_stage_progress
	FOR EACH ROW EXECUTE FUNCTION app.chore_stage_progress_take_back_points();
--> statement-breakpoint

-- As in 0024, plus the stage's own points (see above). `points` is what this
-- call paid: the stage, and the chore's points too if this stage finished it.
CREATE OR REPLACE FUNCTION app.complete_chore_stage(
	instance uuid,
	stage uuid,
	done_by uuid DEFAULT NULL,
	acting_as uuid DEFAULT NULL
)
	RETURNS TABLE (
		chore_completed boolean,
		completion_id uuid,
		points integer,
		already_completed boolean,
		next_member_id uuid,
		credited_member_id uuid,
		approval_status text
	)
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		i public.chore_instances%ROWTYPE;
		s public.chore_stages%ROWTYPE;
		doer uuid;
		who record;
		stage_count integer;
		done_count integer;
		r record;
		favour boolean;
		stage_award integer := 0;
	BEGIN
		SELECT * INTO i FROM public.chore_instances ci WHERE ci.id = instance FOR UPDATE;
		IF NOT FOUND OR NOT app.is_household_member(i.household_id) THEN
			RAISE EXCEPTION 'no chore instance %', instance USING ERRCODE = 'no_data_found';
		END IF;
		IF i.assigned_member_id IS NULL THEN
			RAISE EXCEPTION 'chore instance % has no assignee', instance USING ERRCODE = 'CP003';
		END IF;
		doer := app.authorize_chore_doer(i.household_id, i.assigned_member_id, done_by);
		SELECT * INTO who FROM app.favour_actor(i.household_id, acting_as);
		IF acting_as IS NOT NULL AND doer <> i.assigned_member_id AND doer IS DISTINCT FROM who.actor THEN
			RAISE EXCEPTION 'on a profile, only that member can be recorded as who did this chore'
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
		VALUES (instance, stage, i.chore_id, i.household_id, doer)
		ON CONFLICT (instance_id, stage_id) DO NOTHING;

		-- The stage pays out now, to whoever checked it off, unless it's a favour
		-- (someone other than the assignee, not acting as a parent): those wait for
		-- app.decide_favour to approve them, as a whole chore's points do.
		favour := doer <> i.assigned_member_id AND NOT who.as_parent;
		IF NOT favour THEN
			stage_award := app.award_stage_points(instance, stage);
		END IF;

		SELECT count(*) INTO stage_count FROM public.chore_stages st WHERE st.chore_id = i.chore_id;
		SELECT count(*) INTO done_count FROM public.chore_stage_progress sp WHERE sp.instance_id = instance;
		IF done_count < stage_count THEN
			RETURN QUERY SELECT false, NULL::uuid, stage_award, false, NULL::uuid, NULL::uuid, NULL::text;
			RETURN;
		END IF;

		SELECT * INTO r FROM app.complete_chore_instance(instance, done_by, acting_as);
		RETURN QUERY SELECT true, r.completion_id, r.points + stage_award, r.already_completed, r.next_member_id,
			r.credited_member_id, r.approval_status;
	END
	$$;
--> statement-breakpoint

-- As in 0024, plus the stages the doer did are paid on approval, and
-- `points` includes them.
CREATE OR REPLACE FUNCTION app.decide_favour(
	completion uuid,
	approve boolean,
	acting_as uuid DEFAULT NULL
)
	RETURNS TABLE (
		approval_status text,
		changed boolean,
		points integer,
		next_member_id uuid,
		decided_by_member_id uuid
	)
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		target public.chore_completions%ROWTYPE;
		cc public.chore_completions%ROWTYPE;
		who record;
		kind text;
		rot public.chore_rotations%ROWTYPE;
		assignee_declined boolean;
		awarded integer := 0;
		stage_awarded integer := 0;
		progress record;
		next_turn uuid;
	BEGIN
		SELECT * INTO target FROM public.chore_completions x WHERE x.id = completion;
		IF NOT FOUND OR NOT app.is_household_member(target.household_id) THEN
			RAISE EXCEPTION 'no completion %', completion USING ERRCODE = 'no_data_found';
		END IF;
		PERFORM 1 FROM public.chore_instances ci WHERE ci.id = target.instance_id FOR UPDATE;
		SELECT * INTO cc FROM public.chore_completions x WHERE x.id = completion FOR UPDATE;

		IF cc.reopened_at IS NOT NULL OR (cc.approval_status = 'approved' AND cc.decided_at IS NULL) THEN
			RAISE EXCEPTION 'completion % is not a favour waiting for a decision', completion
				USING ERRCODE = 'CP005';
		END IF;

		SELECT * INTO who FROM app.favour_actor(cc.household_id, acting_as);
		IF who.actor IS NOT DISTINCT FROM cc.done_by_member_id THEN
			RAISE EXCEPTION 'you can''t decide a favour you did yourself'
				USING ERRCODE = 'insufficient_privilege';
		END IF;

		assignee_declined := cc.approval_status = 'declined'
			AND cc.escalated_at IS NULL
			AND cc.decided_by_member_id = cc.member_id;

		IF who.as_parent THEN
			IF NOT (cc.approval_status = 'pending' OR assignee_declined) THEN
				-- A parent already decided it: final.
				RETURN QUERY SELECT cc.approval_status::text, false, 0, NULL::uuid, cc.decided_by_member_id;
				RETURN;
			END IF;
			IF assignee_declined AND NOT approve THEN
				-- The assignee's decline stands, and now it's a parent's: final.
				UPDATE public.chore_completions x
				SET decided_by_member_id = who.actor, decided_at = now()
				WHERE x.id = completion;
				RETURN QUERY SELECT 'declined'::text, true, 0, NULL::uuid, who.actor;
				RETURN;
			END IF;
		ELSIF who.actor IS NOT DISTINCT FROM cc.member_id THEN
			IF cc.approval_status <> 'pending' THEN
				RETURN QUERY SELECT cc.approval_status::text, false, 0, NULL::uuid, cc.decided_by_member_id;
				RETURN;
			END IF;
			IF cc.escalated_at IS NOT NULL THEN
				RAISE EXCEPTION 'a parent has been asked to decide this favour'
					USING ERRCODE = 'CP006';
			END IF;
		ELSE
			RAISE EXCEPTION 'only the member whose chore it is, or a parent, can decide this favour'
				USING ERRCODE = 'insufficient_privilege';
		END IF;

		IF NOT approve THEN
			UPDATE public.chore_completions x
			SET approval_status = 'declined', decided_by_member_id = who.actor, decided_at = now()
			WHERE x.id = completion;
			DELETE FROM public.chore_stage_progress sp
			WHERE sp.instance_id = cc.instance_id
				AND sp.completed_by_member_id IS NOT DISTINCT FROM cc.done_by_member_id;
			RETURN QUERY SELECT 'declined'::text, true, 0, NULL::uuid, who.actor;
			RETURN;
		END IF;

		-- Approving a declined favour takes the instance back for it, so nothing
		-- else may have completed it since.
		IF cc.approval_status = 'declined' AND EXISTS (
			SELECT 1 FROM public.chore_completions o
			WHERE o.instance_id = cc.instance_id
				AND o.id <> cc.id
				AND o.reopened_at IS NULL
				AND o.approval_status <> 'declined'
		) THEN
			RAISE EXCEPTION 'the chore has been completed again since this favour was declined'
				USING ERRCODE = 'CP007';
		END IF;

		UPDATE public.chore_completions x
		SET approval_status = 'approved', decided_by_member_id = who.actor, decided_at = now()
		WHERE x.id = completion;

		INSERT INTO public.chore_stage_progress (instance_id, stage_id, chore_id, household_id, completed_by_member_id)
		SELECT cc.instance_id, st.id, st.chore_id, cc.household_id, cc.done_by_member_id
		FROM public.chore_stages st
		WHERE st.chore_id = cc.chore_id
		ON CONFLICT (instance_id, stage_id) DO NOTHING;

		-- The stages the doer did were waiting on this decision: pay them now.
		-- Stages the assignee checked themselves were paid when they were checked,
		-- and award_stage_points skips anything already paid.
		FOR progress IN
			SELECT sp.stage_id FROM public.chore_stage_progress sp WHERE sp.instance_id = cc.instance_id
		LOOP
			stage_awarded := stage_awarded + app.award_stage_points(cc.instance_id, progress.stage_id);
		END LOOP;

		-- The doer may have left the household since; then nobody gets the points.
		IF cc.points > 0 AND cc.done_by_member_id IS NOT NULL THEN
			INSERT INTO public.points_ledger (household_id, member_id, delta, reason, completion_id)
			VALUES (cc.household_id, cc.done_by_member_id, cc.points, 'completion', completion);
			awarded := cc.points;
		END IF;

		SELECT ch.type::text INTO kind FROM public.chores ch WHERE ch.id = cc.chore_id;
		IF kind = 'rotation' THEN
			-- Only while it's still the assignee's turn: if a parent skipped them
			-- meanwhile, or they've since done a later turn, the turn has already
			-- moved on and stays where it is.
			SELECT * INTO rot FROM public.chore_rotations r WHERE r.chore_id = cc.chore_id FOR UPDATE;
			IF FOUND AND rot.current_member_id IS NOT DISTINCT FROM cc.member_id THEN
				SELECT a.member_id INTO next_turn
				FROM app.advance_chore_rotation_turn(cc.chore_id, cc.member_id, true) a;
			END IF;
		END IF;

		RETURN QUERY SELECT 'approved'::text, true, awarded + stage_awarded, next_turn, who.actor;
	END
	$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION
	app.award_stage_points(uuid, uuid),
	app.reverse_stage_points(uuid, uuid),
	app.chore_stage_progress_take_back_points()
	FROM PUBLIC;
