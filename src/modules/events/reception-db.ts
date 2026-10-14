import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { events } from "./db";
import { users } from "@/modules/users/db";

export const eventReceptionists = pgTable(
  "event_receptionists",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("event_receptionists_event_user_unique").on(table.eventId, table.userId)],
);
