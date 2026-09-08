import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// A real (non-local) Supabase project mandates TLS; the local `supabase start` stack doesn't
// serve TLS on its Postgres port at all, so forcing it there breaks every connection.
const isLocal = /^(127\.0\.0\.1|localhost)/.test(
  env.DATABASE_URL.replace(/^[a-z]+:\/\/[^@]*@/, ""),
);
const client = postgres(env.DATABASE_URL, { ssl: isLocal ? false : "require" });

export const db = drizzle(client, { schema });
