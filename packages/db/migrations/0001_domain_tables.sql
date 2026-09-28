CREATE TYPE "public"."household_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "chores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assigned_to" uuid,
	"created_by" uuid DEFAULT app.current_user_id(),
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "household_members" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "household_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_household_id_user_id_pk" PRIMARY KEY("household_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "household_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid DEFAULT app.current_user_id() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chores_household_id_idx" ON "chores" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "chores_assigned_to_idx" ON "chores" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "household_members_user_id_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "chores_select" ON "chores" AS PERMISSIVE FOR SELECT TO "authenticated_backend" USING (app.is_household_member("chores"."household_id"));--> statement-breakpoint
CREATE POLICY "chores_insert" ON "chores" AS PERMISSIVE FOR INSERT TO "authenticated_backend" WITH CHECK (app.is_household_member("chores"."household_id")
				and "chores"."created_by" = (select app.current_user_id())
				and ("chores"."assigned_to" is null or app.is_member_of("chores"."household_id", "chores"."assigned_to")));--> statement-breakpoint
CREATE POLICY "chores_update" ON "chores" AS PERMISSIVE FOR UPDATE TO "authenticated_backend" USING (app.is_household_member("chores"."household_id")) WITH CHECK (app.is_household_member("chores"."household_id")
				and ("chores"."assigned_to" is null or app.is_member_of("chores"."household_id", "chores"."assigned_to")));--> statement-breakpoint
CREATE POLICY "chores_delete" ON "chores" AS PERMISSIVE FOR DELETE TO "authenticated_backend" USING (app.is_household_member("chores"."household_id"));--> statement-breakpoint
CREATE POLICY "household_members_select" ON "household_members" AS PERMISSIVE FOR SELECT TO "authenticated_backend" USING (app.is_household_member("household_members"."household_id"));--> statement-breakpoint
CREATE POLICY "household_members_insert" ON "household_members" AS PERMISSIVE FOR INSERT TO "authenticated_backend" WITH CHECK (app.is_household_owner("household_members"."household_id"));--> statement-breakpoint
CREATE POLICY "household_members_update" ON "household_members" AS PERMISSIVE FOR UPDATE TO "authenticated_backend" USING (app.is_household_owner("household_members"."household_id")) WITH CHECK (app.is_household_owner("household_members"."household_id"));--> statement-breakpoint
CREATE POLICY "household_members_delete" ON "household_members" AS PERMISSIVE FOR DELETE TO "authenticated_backend" USING (app.is_household_owner("household_members"."household_id") or "household_members"."user_id" = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "households_select" ON "households" AS PERMISSIVE FOR SELECT TO "authenticated_backend" USING (app.is_household_member("households"."id") or "households"."created_by" = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "households_insert" ON "households" AS PERMISSIVE FOR INSERT TO "authenticated_backend" WITH CHECK ("households"."created_by" = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "households_update" ON "households" AS PERMISSIVE FOR UPDATE TO "authenticated_backend" USING (app.is_household_owner("households"."id")) WITH CHECK (app.is_household_owner("households"."id"));--> statement-breakpoint
CREATE POLICY "households_delete" ON "households" AS PERMISSIVE FOR DELETE TO "authenticated_backend" USING (app.is_household_owner("households"."id"));