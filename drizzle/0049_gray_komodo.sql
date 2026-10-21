CREATE TYPE "public"."raffle_draw_mode" AS ENUM('manual', 'automatic');--> statement-breakpoint
ALTER TABLE "raffles" ADD COLUMN "draw_mode" "raffle_draw_mode" DEFAULT 'manual' NOT NULL;