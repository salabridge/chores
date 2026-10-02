-- SB-25: rotation turns. The turn-advance function, the triggers that keep the
-- current turn on an eligible member, and the commit-time check that a
-- rotation has at least 2 eligible members. Hand-written because drizzle-kit
-- doesn't manage functions or triggers. See "Rotations" in ../README.md.
--
-- Custom SQLSTATEs raised here (mapped to errors in ../src/rotations.ts):
--   RT001  the turn already moved (stale `from_member`)
--   RT002  the rotation has no eligible members to hand the turn to

-- The next eligible member after `after_position`, in position order, wrapping
-- to the start of the loop ("Loop Reset"; `wrapped` is true then). NULL
-- `after_position` starts from the top. `skip_member` is left out (used while
-- that member is being deleted). With a single eligible member who is
-- current, it returns that member again, wrapped. No rows when nobody's
-- eligible. Internal: called by the SECURITY DEFINER functions below.
CREATE OR REPLACE FUNCTION app.next_rotation_member(
	chore uuid,
	after_position smallint,
	skip_member uuid
) RETURNS TABLE (member_id uuid, wrapped boolean)
	LANGUAGE sql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
		SELECT m.member_id, coalesce(m.position <= after_position, false)
		FROM public.chore_rotation_members m
		WHERE m.chore_id = chore
			AND m.eligible
			AND m.member_id IS DISTINCT FROM skip_member
		ORDER BY coalesce(m.position <= after_position, false), m.position
		LIMIT 1
	$$;
--> statement-breakpoint

-- Moves a rotation's turn to the next eligible member and returns who it is
-- now and whether the loop wrapped. Locks the rotation row, so call it in the
-- same transaction as whatever records the completion (SB-26's points ledger)
-- and both commit or neither does.
--
-- `from_member` is whose turn the caller thinks it is. If the turn has already
-- moved (a double tap, two devices), this raises RT001 instead of advancing
-- twice.
--
-- `completed`:
--   true   a completion. The signed-in user must be a parent, or be able to
--          act as the member whose turn it is (themselves, or a managed kid
--          they parent). That member becomes Done Last.
--   false  a skip (Overview "Skip", SB-29): advances without changing Done
--          Last, and without points. Parents only.
CREATE OR REPLACE FUNCTION app.advance_chore_rotation(
	chore uuid,
	from_member uuid,
	completed boolean
) RETURNS TABLE (member_id uuid, wrapped boolean)
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	#variable_conflict use_column
	DECLARE
		r public.chore_rotations%ROWTYPE;
		cur_position smallint;
		next_member uuid;
		next_wrapped boolean;
	BEGIN
		SELECT * INTO r FROM public.chore_rotations c
		WHERE c.chore_id = chore
		FOR UPDATE;
		IF NOT FOUND OR NOT app.is_household_member(r.household_id) THEN
			RAISE EXCEPTION 'no rotation for chore %', chore
				USING ERRCODE = 'no_data_found';
		END IF;

		IF completed THEN
			IF NOT (
				app.is_household_parent(r.household_id)
				OR (r.current_member_id IS NOT NULL AND app.can_act_as_member(r.current_member_id))
			) THEN
				RAISE EXCEPTION 'only a parent or the member whose turn it is can complete this turn'
					USING ERRCODE = 'insufficient_privilege';
			END IF;
		ELSIF NOT app.is_household_parent(r.household_id) THEN
			RAISE EXCEPTION 'only a parent can skip a turn'
				USING ERRCODE = 'insufficient_privilege';
		END IF;

		IF r.current_member_id IS DISTINCT FROM from_member THEN
			RAISE EXCEPTION 'the turn has already moved on (it is now %)', r.current_member_id
				USING ERRCODE = 'RT001';
		END IF;

		SELECT m.position INTO cur_position
		FROM public.chore_rotation_members m
		WHERE m.chore_id = chore AND m.member_id = r.current_member_id;

		SELECT n.member_id, n.wrapped INTO next_member, next_wrapped
		FROM app.next_rotation_member(chore, cur_position, NULL) n;
		IF next_member IS NULL THEN
			RAISE EXCEPTION 'rotation for chore % has no eligible members', chore
				USING ERRCODE = 'RT002';
		END IF;

		UPDATE public.chore_rotations c
		SET current_member_id = next_member,
			turn_started_at = now(),
			last_completed_member_id = CASE WHEN completed THEN r.current_member_id ELSE c.last_completed_member_id END,
			last_completed_at = CASE WHEN completed THEN now() ELSE c.last_completed_at END,
			updated_at = now()
		WHERE c.chore_id = chore;

		RETURN QUERY SELECT next_member, next_wrapped;
	END
	$$;
--> statement-breakpoint

-- Excluding or removing the member whose turn it is hands the turn to the next
-- eligible member right away (SB-25 decision: don't leave an excluded member
-- holding the turn). Removal includes leaving the household, which cascades
-- here. If nobody else is eligible the turn becomes NULL, which the
-- commit-time check below rejects unless the member left the household.
CREATE OR REPLACE FUNCTION app.chore_rotation_member_handoff() RETURNS trigger
	LANGUAGE plpgsql SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		m public.chore_rotation_members%ROWTYPE;
	BEGIN
		IF TG_OP = 'DELETE' THEN
			m := OLD;
		ELSE
			m := NEW;
		END IF;
		UPDATE public.chore_rotations c
		SET current_member_id = (
				SELECT n.member_id
				FROM app.next_rotation_member(m.chore_id, m.position, m.member_id) n
			),
			turn_started_at = now(),
			updated_at = now()
		WHERE c.chore_id = m.chore_id
			AND c.current_member_id = m.member_id
			-- Not while the whole household is being deleted: the rotation is
			-- going too, and updating it would fail its household FK.
			AND EXISTS (SELECT 1 FROM public.households h WHERE h.id = c.household_id);
		IF TG_OP = 'DELETE' THEN
			RETURN OLD;
		END IF;
		RETURN NEW;
	END
	$$;
--> statement-breakpoint
CREATE TRIGGER chore_rotation_members_handoff_on_exclude
	AFTER UPDATE OF eligible ON public.chore_rotation_members
	FOR EACH ROW
	WHEN (OLD.eligible AND NOT NEW.eligible)
	EXECUTE FUNCTION app.chore_rotation_member_handoff();
--> statement-breakpoint
CREATE TRIGGER chore_rotation_members_handoff_on_delete
	BEFORE DELETE ON public.chore_rotation_members
	FOR EACH ROW
	EXECUTE FUNCTION app.chore_rotation_member_handoff();
--> statement-breakpoint

-- Commit-time rules for a rotation. Deferred, so a parent can create the
-- rotation and its members (or reorder and re-include them) in one
-- transaction and only the end state is checked:
--
-- - the chore is a `rotation` chore;
-- - at least 2 members are eligible;
-- - the current turn is an eligible member (or NULL once nobody's eligible).
--
-- Advancing (an UPDATE of current_member_id) only re-checks the last rule.
-- A member leaving the household, or the chore being deleted, skips the
-- check, so those never fail; a loop left with fewer than 2 eligible members
-- that way is shown as needing attention instead.
CREATE OR REPLACE FUNCTION app.check_chore_rotation() RETURNS trigger
	LANGUAGE plpgsql SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		target uuid;
		full_check boolean := true;
		current_member uuid;
		chore_type text;
		eligible_count integer;
	BEGIN
		IF TG_TABLE_NAME = 'chore_rotations' THEN
			target := NEW.chore_id;
			full_check := TG_OP = 'INSERT';
		ELSIF TG_OP = 'DELETE' THEN
			target := OLD.chore_id;
			IF NOT EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.id = OLD.member_id) THEN
				RETURN NULL;
			END IF;
		ELSE
			target := NEW.chore_id;
		END IF;

		SELECT c.current_member_id, ch.type::text INTO current_member, chore_type
		FROM public.chore_rotations c
		JOIN public.chores ch ON ch.id = c.chore_id
		WHERE c.chore_id = target;
		IF NOT FOUND THEN
			RETURN NULL;
		END IF;

		IF full_check THEN
			IF chore_type <> 'rotation' THEN
				RAISE EXCEPTION 'chore % is not a rotation chore', target
					USING ERRCODE = 'check_violation', CONSTRAINT = 'chore_rotations_chore_type_check';
			END IF;
			SELECT count(*) INTO eligible_count
			FROM public.chore_rotation_members m
			WHERE m.chore_id = target AND m.eligible;
			IF eligible_count < 2 THEN
				RAISE EXCEPTION 'a rotation needs at least 2 eligible members (chore % has %)', target, eligible_count
					USING ERRCODE = 'check_violation', CONSTRAINT = 'chore_rotations_min_eligible_check';
			END IF;
		END IF;

		-- The turn is NULL only when nobody's left to take it (the last
		-- eligible member left the household).
		IF (current_member IS NULL AND EXISTS (
			SELECT 1 FROM public.chore_rotation_members m
			WHERE m.chore_id = target AND m.eligible
		)) OR (current_member IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM public.chore_rotation_members m
			WHERE m.chore_id = target AND m.member_id = current_member AND m.eligible
		)) THEN
			RAISE EXCEPTION 'the current turn of chore % must be an eligible member of its rotation', target
				USING ERRCODE = 'check_violation', CONSTRAINT = 'chore_rotations_current_member_check';
		END IF;
		RETURN NULL;
	END
	$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER chore_rotations_check
	AFTER INSERT OR UPDATE OF current_member_id ON public.chore_rotations
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW
	EXECUTE FUNCTION app.check_chore_rotation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER chore_rotation_members_check
	AFTER INSERT OR UPDATE OR DELETE ON public.chore_rotation_members
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW
	EXECUTE FUNCTION app.check_chore_rotation();
--> statement-breakpoint
REVOKE ALL ON FUNCTION
	app.next_rotation_member(uuid, smallint, uuid),
	app.advance_chore_rotation(uuid, uuid, boolean),
	app.chore_rotation_member_handoff(),
	app.check_chore_rotation()
	FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.advance_chore_rotation(uuid, uuid, boolean) TO authenticated_backend;
