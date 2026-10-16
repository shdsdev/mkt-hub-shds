CREATE TYPE "public"."question_session_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('pending', 'approved', 'rejected', 'answered', 'archived');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_approve';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_reject';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_answer';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_publish';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_archive';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_restore';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_regenerate_code';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_close_session';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_export';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'question_merge_duplicate';--> statement-breakpoint
CREATE TABLE "question_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_question_id" uuid NOT NULL,
	"target_question_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"company" text NOT NULL,
	"token_hash" text NOT NULL,
	"consent_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_question_topics" (
	"question_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "question_question_topics_pk" PRIMARY KEY("question_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "question_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"status" "question_session_status" DEFAULT 'open' NOT NULL,
	"code_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_votes" (
	"question_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_votes_question_participant_pk" PRIMARY KEY("question_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"status" "question_status" DEFAULT 'pending' NOT NULL,
	"answer_text" text,
	"approved_by" uuid,
	"answered_by" uuid,
	"published_by" uuid,
	"approved_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_duplicates" ADD CONSTRAINT "question_duplicates_source_question_id_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_duplicates" ADD CONSTRAINT "question_duplicates_target_question_id_questions_id_fk" FOREIGN KEY ("target_question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_duplicates" ADD CONSTRAINT "question_duplicates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_participants" ADD CONSTRAINT "question_participants_session_id_question_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."question_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_question_topics" ADD CONSTRAINT "question_question_topics_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_question_topics" ADD CONSTRAINT "question_question_topics_topic_id_question_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."question_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sessions" ADD CONSTRAINT "question_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sessions" ADD CONSTRAINT "question_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_session_id_question_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."question_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_votes" ADD CONSTRAINT "question_votes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_votes" ADD CONSTRAINT "question_votes_participant_id_question_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."question_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_session_id_question_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."question_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_participant_id_question_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."question_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "question_duplicates_pair_unique" ON "question_duplicates" USING btree ("source_question_id","target_question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_participants_session_token_unique" ON "question_participants" USING btree ("session_id","token_hash");--> statement-breakpoint
CREATE INDEX "question_participants_session_idx" ON "question_participants" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_sessions_event_unique" ON "question_sessions" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_sessions_code_hash_unique" ON "question_sessions" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "question_sessions_organization_idx" ON "question_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_topics_session_name_unique" ON "question_topics" USING btree ("session_id",lower("name"));--> statement-breakpoint
CREATE INDEX "question_votes_question_idx" ON "question_votes" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "questions_session_status_idx" ON "questions" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "questions_session_normalized_text_idx" ON "questions" USING btree ("session_id","normalized_text");