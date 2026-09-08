import { pgSchema, uuid, text } from "drizzle-orm/pg-core";

// Reference-only declaration of Supabase's auth.users — Supabase owns this table's migrations
// (ADR-005). Deliberately NOT re-exported by src/db/schema.ts, so drizzle-kit never generates a
// CREATE TABLE for it; it exists purely so our own tables can express a real FK to auth.users.id.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
});
