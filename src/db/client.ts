import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { getPostgresOptions } from "./connection";
import * as schema from "./schema";

// Transaction Pooler (6543) does not support prepared statements. Direct/session connections
// keep the default because they support them and are used by migration tooling.
const client = postgres(env.DATABASE_URL, getPostgresOptions(env.DATABASE_URL));

export const db = drizzle(client, { schema });
