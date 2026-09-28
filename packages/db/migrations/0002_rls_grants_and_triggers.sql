-- Table access for the RLS role, and the trigger that makes a household's
-- creator its first owner. Hand-written because drizzle-kit doesn't manage
-- grants or triggers.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE households, household_members, chores TO authenticated_backend;
--> statement-breakpoint
-- New tables in public get the same grants (their RLS policies still apply).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated_backend;
--> statement-breakpoint

-- Without this, nobody could ever insert the first member of a household:
-- household_members inserts require an existing owner.
CREATE OR REPLACE FUNCTION app.add_household_creator() RETURNS trigger
	LANGUAGE plpgsql SECURITY DEFINER
	SET search_path = pg_catalog, public
	AS $$
	BEGIN
		INSERT INTO public.household_members (household_id, user_id, role)
		VALUES (NEW.id, NEW.created_by, 'owner');
		RETURN NEW;
	END
	$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.add_household_creator() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER households_add_creator
	AFTER INSERT ON households
	FOR EACH ROW EXECUTE FUNCTION app.add_household_creator();
