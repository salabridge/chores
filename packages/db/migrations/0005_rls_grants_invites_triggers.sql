-- SB-23: grants, the creator trigger's new display name, and accepting
-- invites. Hand-written because drizzle-kit doesn't manage grants or functions.

-- The default privileges from 0002 already cover these new tables; this keeps
-- the grants explicit.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE household_member_pins, household_invites TO authenticated_backend;
--> statement-breakpoint

-- A member row's identity never changes through the app: no updates to `id`,
-- `household_id`, `user_id`, or `joined_at`. (Attaching a login to a managed
-- kid, when we build it, will go through a SECURITY DEFINER function like
-- accept_household_invite below.) RLS decides which rows; this decides which
-- columns.
REVOKE UPDATE ON TABLE household_members FROM authenticated_backend;
--> statement-breakpoint
GRANT UPDATE (role, display_name, avatar_color, avatar_initial, birth_year, updated_at)
	ON TABLE household_members TO authenticated_backend;
--> statement-breakpoint

-- The household's creator becomes its owner, now with a display name taken
-- from their auth user.
CREATE OR REPLACE FUNCTION app.add_household_creator() RETURNS trigger
	LANGUAGE plpgsql SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		INSERT INTO public.household_members (household_id, user_id, role, display_name)
		SELECT NEW.id, NEW.created_by, 'owner',
			coalesce(left(nullif(btrim(u.name), ''), 50), 'Parent')
		FROM neon_auth."user" u
		WHERE u.id = NEW.created_by;
		RETURN NEW;
	END
	$$;
--> statement-breakpoint

-- Accepts an invite for the signed-in user. `token` is the raw token from the
-- invite link; it's matched by its SHA-256 hex (household_invites.token_hash).
-- The user's verified email has to match the invite. Adds them to the
-- household with the invite's role and returns the new member row's id.
--
-- No parental approval step: invites are issued by a parent (or owner), so
-- the invite is the approval.
CREATE OR REPLACE FUNCTION app.accept_household_invite(token text) RETURNS uuid
	LANGUAGE plpgsql VOLATILE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	DECLARE
		uid uuid := app.current_user_id();
		inv public.household_invites%ROWTYPE;
		u_email text;
		u_name text;
		u_verified boolean;
		new_member uuid;
	BEGIN
		IF uid IS NULL THEN
			RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
		END IF;

		SELECT * INTO inv FROM public.household_invites i
		WHERE i.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
		FOR UPDATE;
		IF NOT FOUND THEN
			RAISE EXCEPTION 'invite not found' USING ERRCODE = 'P0002';
		END IF;
		IF inv.accepted_at IS NOT NULL THEN
			RAISE EXCEPTION 'invite already accepted' USING ERRCODE = '22023';
		END IF;
		IF inv.expires_at <= now() THEN
			RAISE EXCEPTION 'invite expired' USING ERRCODE = '22023';
		END IF;

		SELECT u.email, u.name, u."emailVerified" INTO u_email, u_name, u_verified
		FROM neon_auth."user" u WHERE u.id = uid;
		IF NOT FOUND OR NOT u_verified OR lower(u_email) <> lower(inv.email) THEN
			RAISE EXCEPTION 'invite is for a different email' USING ERRCODE = '42501';
		END IF;

		IF EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.household_id = inv.household_id AND m.user_id = uid
		) THEN
			RAISE EXCEPTION 'already a member of this household' USING ERRCODE = '23505';
		END IF;

		INSERT INTO public.household_members (household_id, user_id, role, display_name)
		VALUES (
			inv.household_id,
			uid,
			inv.role,
			coalesce(
				inv.display_name,
				left(nullif(btrim(u_name), ''), 50),
				left(split_part(u_email, '@', 1), 50)
			)
		)
		RETURNING id INTO new_member;

		UPDATE public.household_invites
		SET accepted_at = now(), accepted_member_id = new_member
		WHERE id = inv.id;

		RETURN new_member;
	END
	$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.accept_household_invite(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.accept_household_invite(text) TO authenticated_backend;
