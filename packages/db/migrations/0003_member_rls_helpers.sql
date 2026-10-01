-- SB-23: RLS helpers that resolve the signed-in user to their household member
-- row, and check whether they're a parent. Created before 0004 because its
-- policies call them. Like the helpers in 0000, they're plpgsql (so they can
-- refer to columns 0004 adds) and SECURITY DEFINER (so policies on
-- household_members can read household_members without recursing).
--
-- Roles (see schema/household-role.ts): `owner` and `parent` are parents;
-- `kid` isn't. Roles are compared as text so these functions don't depend on
-- the household_role type, which 0004 recreates.

-- The signed-in user's member row in `household`, or NULL.
CREATE OR REPLACE FUNCTION app.current_member_id(household uuid) RETURNS uuid
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN (
			SELECT m.id FROM public.household_members m
			WHERE m.household_id = household AND m.user_id = app.current_user_id()
		);
	END
	$$;
--> statement-breakpoint

-- True when the signed-in user is a parent (owner or parent) in `household`.
-- The check for parent-only routes and mutations.
CREATE OR REPLACE FUNCTION app.is_household_parent(household uuid) RETURNS boolean
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.household_id = household
				AND m.user_id = app.current_user_id()
				AND m.role::text IN ('owner', 'parent')
		);
	END
	$$;
--> statement-breakpoint

-- True when `member` is the id of a member row in `household`.
CREATE OR REPLACE FUNCTION app.is_member_id_in(household uuid, member uuid) RETURNS boolean
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.id = member AND m.household_id = household
		);
	END
	$$;
--> statement-breakpoint

-- True when the member row `member` belongs to the signed-in user.
CREATE OR REPLACE FUNCTION app.is_own_member(member uuid) RETURNS boolean
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.id = member AND m.user_id = app.current_user_id()
		);
	END
	$$;
--> statement-breakpoint

-- True when the member row `member` belongs to the signed-in user and is a parent.
CREATE OR REPLACE FUNCTION app.is_own_parent_member(member uuid) RETURNS boolean
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.id = member
				AND m.user_id = app.current_user_id()
				AND m.role::text IN ('owner', 'parent')
		);
	END
	$$;
--> statement-breakpoint

-- True when the signed-in user may act as the member `member`: it's their own
-- row, or it's a managed kid (no login) and they're a parent in its household.
-- For tables where a member does something (completions, ledger), so parents
-- can act on behalf of managed kids.
CREATE OR REPLACE FUNCTION app.can_act_as_member(member uuid) RETURNS boolean
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.id = member
				AND (
					m.user_id = app.current_user_id()
					OR (
						m.user_id IS NULL
						AND m.role::text = 'kid'
						AND app.is_household_parent(m.household_id)
					)
				)
		);
	END
	$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION
	app.current_member_id(uuid),
	app.is_household_parent(uuid),
	app.is_member_id_in(uuid, uuid),
	app.is_own_member(uuid),
	app.is_own_parent_member(uuid),
	app.can_act_as_member(uuid)
	FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
	app.current_member_id(uuid),
	app.is_household_parent(uuid),
	app.is_member_id_in(uuid, uuid),
	app.is_own_member(uuid),
	app.is_own_parent_member(uuid),
	app.can_act_as_member(uuid)
	TO authenticated_backend;
