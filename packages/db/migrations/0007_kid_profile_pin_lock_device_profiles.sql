CREATE TABLE "device_profiles" (
	"device_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"active_member_id" uuid,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_profiles_device_hash_user_id_pk" PRIMARY KEY("device_hash","user_id")
);
--> statement-breakpoint
ALTER TABLE "device_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "household_member_pins" ADD COLUMN "failed_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "household_member_pins" ADD COLUMN "last_failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "household_member_pins" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "device_profiles" ADD CONSTRAINT "device_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_profiles" ADD CONSTRAINT "device_profiles_active_member_id_household_members_id_fk" FOREIGN KEY ("active_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_profiles_user_id_session_id_idx" ON "device_profiles" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE POLICY "device_profiles_select" ON "device_profiles" AS PERMISSIVE FOR SELECT TO "authenticated_backend" USING ("device_profiles"."user_id" = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "device_profiles_insert" ON "device_profiles" AS PERMISSIVE FOR INSERT TO "authenticated_backend" WITH CHECK ("device_profiles"."user_id" = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "device_profiles_update" ON "device_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated_backend" USING ("device_profiles"."user_id" = (select app.current_user_id())) WITH CHECK ("device_profiles"."user_id" = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "device_profiles_delete" ON "device_profiles" AS PERMISSIVE FOR DELETE TO "authenticated_backend" USING ("device_profiles"."user_id" = (select app.current_user_id()));
--> statement-breakpoint
-- Table access for the RLS role (drizzle-kit does not manage grants). The pin
-- columns added above are covered by the table-level grant from 0005.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE device_profiles TO authenticated_backend;
