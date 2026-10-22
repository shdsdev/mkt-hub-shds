ALTER TABLE "theme_color_overrides" DROP CONSTRAINT "theme_color_overrides_updated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "utm_presets" DROP CONSTRAINT "utm_presets_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "event_registrations" DROP CONSTRAINT "event_registrations_reviewed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_notifications" DROP CONSTRAINT "user_notifications_recipient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "raffle_audit" DROP CONSTRAINT "raffle_audit_actor_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "raffle_draws" DROP CONSTRAINT "raffle_draws_claimed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "raffle_draws" DROP CONSTRAINT "raffle_draws_invalidated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "raffle_prizes" DROP CONSTRAINT "raffle_prizes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "raffles" DROP CONSTRAINT "raffles_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "question_duplicates" DROP CONSTRAINT "question_duplicates_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_answered_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_published_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "theme_color_overrides" ADD CONSTRAINT "theme_color_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD CONSTRAINT "utm_presets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD CONSTRAINT "raffle_audit_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_invalidated_by_users_id_fk" FOREIGN KEY ("invalidated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_duplicates" ADD CONSTRAINT "question_duplicates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;