-- Prerequisites for the RLS policies on our domain tables. drizzle-kit can't
-- manage roles or functions, so they live in this hand-written migration.

-- Login role for user-facing queries. No BYPASSRLS, so policies apply to it.
-- Its password is set out of band (never committed); see packages/db/README.md.
DO $$
BEGIN
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated_backend') THEN
		CREATE ROLE authenticated_backend WITH LOGIN NOBYPASSRLS;
	END IF;
END
$$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO authenticated_backend;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO authenticated_backend;
--> statement-breakpoint

-- The signed-in user's id, taken from the verified JWT claims that the app sets
-- per transaction with set_config('request.jwt.claims', ..., true). NULL when
-- no claims are set, so every policy fails closed.
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
	LANGUAGE sql STABLE
	AS $$
		SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
	$$;
--> statement-breakpoint

-- Membership checks used by the policies. SECURITY DEFINER (run as the table
-- owner, which bypasses RLS) so that policies on household_members can look at
-- household_members without recursing into themselves. plpgsql so the table
-- can be created after these functions.
CREATE OR REPLACE FUNCTION app.is_member_of(household uuid, member uuid) RETURNS boolean
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.household_id = household AND m.user_id = member
		);
	END
	$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.is_household_member(household uuid) RETURNS boolean
	LANGUAGE sql STABLE
	AS $$ SELECT app.is_member_of(household, app.current_user_id()) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.is_household_owner(household uuid) RETURNS boolean
	LANGUAGE plpgsql STABLE SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		RETURN EXISTS (
			SELECT 1 FROM public.household_members m
			WHERE m.household_id = household
				AND m.user_id = app.current_user_id()
				AND m.role = 'owner'
		);
	END
	$$;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated_backend;
