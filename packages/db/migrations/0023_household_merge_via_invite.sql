-- SB-76: an owner of another household accepts an invite by moving their
-- household into the inviter's. Hand-written (drizzle-kit doesn't manage
-- functions); `drizzle-kit generate --custom` made the empty file and the
-- unchanged snapshot. See "Merging a household on invite accept" in
-- ../README.md.
--
-- - app.claim_open_invite (internal, not granted): the invite checks that
--   app.accept_household_invite did inline in 0020, moved out so both callers
--   run exactly the same ones, in the same order, with the same HINTs.
-- - app.accept_household_invite: same signature, checks and behaviour as
--   0020; only the invite checks now come from claim_open_invite. CREATE OR
--   REPLACE keeps its grants.
-- - app.merge_household_via_invite(token, confirm_household_id): granted to
--   authenticated_backend like accept_household_invite.
--
-- New HINTs (on top of 0020's), matched by the web app:
--   not-owner        the caller isn't an owner of confirm_household_id (or it
--                    doesn't exist; the two aren't told apart)
--   same-household   confirm_household_id is the invite's own household

-- Finds the invite for `token` and checks the signed-in user may accept it:
-- signed in, the invite exists and is still open, and their verified email is
-- the one it was sent to. Locks the invite row (FOR UPDATE) for the rest of
-- the caller's transaction, so two accepts of one invite queue up and the
-- second sees it accepted. Internal: only called by the two functions below.
CREATE OR REPLACE FUNCTION app.claim_open_invite(token text)
	RETURNS public.household_invites
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		uid uuid := app.current_user_id();
		inv public.household_invites%ROWTYPE;
		u_email text;
		u_verified boolean;
	BEGIN
		IF uid IS NULL THEN
			RAISE EXCEPTION 'not signed in'
				USING ERRCODE = '42501', HINT = 'not-signed-in';
		END IF;

		SELECT * INTO inv FROM public.household_invites i
		WHERE i.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
		FOR UPDATE;
		IF NOT FOUND THEN
			RAISE EXCEPTION 'invite not found'
				USING ERRCODE = 'P0002', HINT = 'invite-not-found';
		END IF;
		IF inv.accepted_at IS NOT NULL THEN
			RAISE EXCEPTION 'invite already accepted'
				USING ERRCODE = '22023', HINT = 'invite-accepted';
		END IF;
		IF inv.expires_at <= now() THEN
			RAISE EXCEPTION 'invite expired'
				USING ERRCODE = '22023', HINT = 'invite-expired';
		END IF;

		SELECT u.email, u."emailVerified" INTO u_email, u_verified
		FROM neon_auth."user" u WHERE u.id = uid;
		IF NOT FOUND OR NOT u_verified OR lower(u_email) <> lower(inv.email) THEN
			RAISE EXCEPTION 'invite is for a different email'
				USING ERRCODE = '42501', HINT = 'wrong-email';
		END IF;

		RETURN inv;
	END
	$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.accept_household_invite(token text) RETURNS uuid
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		uid uuid := app.current_user_id();
		inv public.household_invites%ROWTYPE;
		u_email text;
		u_name text;
		new_member uuid;
	BEGIN
		inv := app.claim_open_invite(token);

		SELECT u.email, u.name INTO u_email, u_name
		FROM neon_auth."user" u WHERE u.id = uid;

		-- One household per user: nothing else picks between memberships.
		-- The lock serializes this user's accepts, so two tabs accepting
		-- invites to different households can't both pass the check.
		PERFORM pg_advisory_xact_lock(hashtext('accept_household_invite:' || uid::text));
		IF EXISTS (SELECT 1 FROM public.household_members m WHERE m.user_id = uid) THEN
			RAISE EXCEPTION 'already in a household'
				USING ERRCODE = 'P0001', HINT = 'already-in-household';
		END IF;

		-- The same cap as adding a managed kid, behind the same household lock.
		IF inv.role = 'kid' THEN
			PERFORM 1 FROM public.households h WHERE h.id = inv.household_id FOR UPDATE;
			IF (SELECT count(*) FROM public.household_members m
			    WHERE m.household_id = inv.household_id AND m.role = 'kid') >= 12 THEN
				RAISE EXCEPTION 'household is full'
					USING ERRCODE = 'P0001', HINT = 'household-full';
			END IF;
		END IF;

		INSERT INTO public.household_members (household_id, user_id, role, display_name, birth_year)
		VALUES (
			inv.household_id,
			uid,
			inv.role,
			coalesce(
				inv.display_name,
				left(nullif(btrim(u_name), ''), 50),
				left(split_part(u_email, '@', 1), 50)
			),
			inv.birth_year
		)
		RETURNING id INTO new_member;

		UPDATE public.household_invites
		SET accepted_at = now(), accepted_member_id = new_member
		WHERE id = inv.id;

		RETURN new_member;
	END
	$$;
--> statement-breakpoint

-- Accepts an invite by moving the caller's own household into the invite's
-- household, then deleting theirs. Returns the caller's new member id. One
-- call is one transaction: any refusal or failure part-way leaves both
-- households as they were.
--
-- `confirm_household_id` is the household the caller saw on the confirm
-- screen and agreed to give up. It must be one they're an owner of
-- (`not-owner` otherwise, also when it doesn't exist), it can't be the
-- invite's own household (`same-household`), and it must be their only
-- membership (`already-in-household`), so one household per user still holds
-- afterwards. The invite is checked by app.claim_open_invite, as for a plain
-- accept.
--
-- What moves (new member rows in the target; the old ids go with the old
-- household):
-- - every member: the caller with the invite's role, other owners and parents
--   as `parent`, kids (managed or with a login) as kids. Nobody gets a role
--   above the invite's: with a kid invite, everyone moves in as a kid (the
--   invite is the target's only approval, and a kid invite must not let its
--   holder bring parents into the target). Display name, avatar
--   color and initial, birth year and weekly goal come along.
-- - PINs of members who are parents in the target, with their lockout state
--   (a locked PIN stays locked). A PIN only belongs to a parent membership,
--   so an owner joining as a kid leaves theirs behind.
-- - each member's points balance, as one `adjustment` ledger row ("Carried
--   over from <old household>", created_by = the caller) when it isn't 0.
--   Adjustments aren't `reward_claim` rows, so the 0012 balance trigger
--   doesn't apply, and a negative balance carries over as it was. A balance
--   outside the integer range is clamped to it rather than failing the merge.
-- A user with a login who is already in the target is skipped (their target
-- membership and its points are left alone; the old one is deleted).
--
-- Everything else (chores, stages, rotations, instances, completions,
-- rewards, claims, skips, reminders, invites, ledger history) is deleted with
-- the old household. Completions are deleted first: since 0019 their FKs to
-- chores and instances are NO ACTION, and doing it explicitly means the
-- household delete never depends on the order Postgres runs its cascades in.
-- Reward claims go first for the same reason (rewards are RESTRICT to them).
-- device_profiles.active_member_id of the old members is set NULL by its FK.
--
-- Ownership of confirm_household_id is checked before any household lock is
-- taken (and again once it's held), so naming someone else's household locks
-- nothing of theirs.
-- Locks, in this order: the invite row (claim_open_invite), the caller's
-- accept lock (shared with accept_household_invite, so an accept and a merge
-- by one user can't interleave), then both household rows in id order (two
-- owners merging each other's households wait instead of deadlocking).
-- Holding the old household's row FOR UPDATE blocks inserts that reference it
-- (members, ledger rows, completions take a key-share lock on it), so the
-- members and balances read below are complete.
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
		WHERE (hm.household_id = inv.household_id AND hm.role = 'kid')
			OR (
				hm.household_id = confirm_household_id
				AND (hm.role = 'kid' OR inv.role = 'kid')
				AND NOT EXISTS (
					SELECT 1 FROM public.household_members t
					WHERE t.household_id = inv.household_id AND t.user_id = hm.user_id
				)
			);
		IF kid_count > 12 THEN
			RAISE EXCEPTION 'household is full'
				USING ERRCODE = 'P0001', HINT = 'household-full';
		END IF;

		FOR m IN
			SELECT hm.*,
				(SELECT coalesce(sum(l.delta), 0) FROM public.points_ledger l
				 WHERE l.member_id = hm.id AND l.household_id = hm.household_id) AS balance
			FROM public.household_members hm
			WHERE hm.household_id = confirm_household_id
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
				INSERT INTO public.points_ledger (household_id, member_id, delta, reason, note, created_by)
				VALUES (
					inv.household_id, new_member,
					greatest(least(m.balance, 2147483647), -2147483648)::integer, 'adjustment',
					left('Carried over from ' || old_name, 200), uid
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

REVOKE ALL ON FUNCTION
	app.claim_open_invite(text),
	app.merge_household_via_invite(text, uuid)
	FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.merge_household_via_invite(text, uuid) TO authenticated_backend;
