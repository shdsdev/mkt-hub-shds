import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Supabase mandates TLS even for local dev connections.
const client = postgres(env.DATABASE_URL, { ssl: "require" });

export const db = drizzle(client, { schema });
