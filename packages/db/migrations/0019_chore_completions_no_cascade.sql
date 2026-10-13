-- SB-61: a chore with a completion can't be hard-deleted. The two foreign keys
-- that let a chore delete reach chore_completions (via chore_instances, and the
-- direct (chore_id, household_id) one) become NO ACTION instead of CASCADE, so
-- deleting a completed chore fails with 23503 even if the completion committed
-- while the DELETE was running. Deleting a household still works: its own
-- cascade removes the completions before the end-of-statement check. Generated
-- by drizzle-kit; hand edits: this header.

ALTER TABLE "chore_completions" DROP CONSTRAINT "chore_completions_instance_fk";
--> statement-breakpoint
ALTER TABLE "chore_completions" DROP CONSTRAINT "chore_completions_chore_fk";
--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_instance_fk" FOREIGN KEY ("instance_id","chore_id") REFERENCES "public"."chore_instances"("id","chore_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_chore_fk" FOREIGN KEY ("chore_id","household_id") REFERENCES "public"."chores"("id","household_id") ON DELETE no action ON UPDATE no action;