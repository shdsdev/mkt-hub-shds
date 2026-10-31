import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

// Explicit opt-in: never run DDL tests against the application's default database.
const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const migration = readFileSync("drizzle/0066_supabase_security.sql", "utf8");
const tables = [...migration.matchAll(/ALTER TABLE "public"\."([^"]+)" ENABLE/g)]
  .map((match) => match[1]);

async function inRollbackTransaction(check: (tx: postgres.TransactionSql) => Promise<void>) {
  if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("Security integration tests require an explicitly selected local database");
  }
  const sql = postgres(databaseUrl, { ssl: false, prepare: false, max: 1 });
  const rollback = new Error("security test rollback");
  try {
    await expect(sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL lock_timeout = '5s'");
      // Recreate pre-migration policies even when the local database is already migrated.
      for (const [prefix, bucket] of [
        ["qr_logos", "qr-logos"],
        ["qr_placement_images", "qr-placement-images"],
        ["event_landing_images", "event-landing-images"],
      ]) {
        await tx.unsafe(`DROP POLICY IF EXISTS "${prefix}_select_owner" ON storage.objects`);
        await tx.unsafe(`DROP POLICY IF EXISTS "${prefix}_select_public" ON storage.objects`);
        await tx.unsafe(`CREATE POLICY "${prefix}_select_public" ON storage.objects FOR SELECT USING (bucket_id = '${bucket}')`);
      }
      await check(tx);
      throw rollback;
    })).rejects.toBe(rollback);
  } finally {
    await sql.end();
  }
}

describe.skipIf(!databaseUrl)("Supabase security migration (local database, rolled back)", () => {
  it("revokes client privileges on all 28 tables while preserving backend access", async () => {
    await inRollbackTransaction(async (tx) => {
      expect(tables).toHaveLength(28);
      const qualifiedTables = tables.map((name) => `public."${name}"`).join(", ");
      // Reproduce hosted projects that grant client access automatically.
      await tx.unsafe(`GRANT ALL ON TABLE ${qualifiedTables} TO PUBLIC, anon, authenticated`);
      await tx.unsafe(migration);
      const protectedTables = await tx`
        SELECT relname FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname IN ${tx(tables)}
          AND relrowsecurity
      `;
      expect(protectedTables).toHaveLength(28);
      for (const role of ["anon", "authenticated"]) {
        const grants = await tx`
          SELECT c.relname, p.privilege
          FROM pg_class c
          CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(privilege)
          WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ${tx(tables)}
            AND has_table_privilege(${role}, c.oid, p.privilege)
        `;
        expect(grants).toHaveLength(0);
        await expect(tx.savepoint(async (sp) => {
          await sp.unsafe(`SET LOCAL ROLE ${role}`);
          await sp`SELECT id FROM public.event_attendees LIMIT 1`;
        })).rejects.toMatchObject({ code: "42501" });
      }
      // Server queries remain usable, without printing application data.
      for (const table of tables) {
        await tx.unsafe(`SELECT 1 FROM public."${table}" LIMIT 1`);
      }
    });
  });

  it("denies rows with RLS even if client SELECT is accidentally granted later", async () => {
    await inRollbackTransaction(async (tx) => {
      await tx.unsafe(migration);
      const id = `security-test-${randomUUID()}`;
      await tx`INSERT INTO public.monitoring_settings (id) VALUES (${id})`;
      await tx.unsafe("GRANT USAGE ON SCHEMA public TO anon, authenticated");
      await tx.unsafe("GRANT SELECT ON public.monitoring_settings TO anon, authenticated");
      for (const role of ["anon", "authenticated"]) {
        await tx.savepoint(async (sp) => {
          await sp.unsafe(`SET LOCAL ROLE ${role}`);
          expect(await sp`SELECT id FROM public.monitoring_settings WHERE id = ${id}`).toHaveLength(0);
          await sp.unsafe("RESET ROLE");
        });
      }
      expect(await tx`SELECT id FROM public.monitoring_settings WHERE id = ${id}`).toHaveLength(1);
    });
  });

  it("preserves uploads and owner deletion without public or cross-owner listing", async () => {
    await inRollbackTransaction(async (tx) => {
      await tx.unsafe(migration);
      // Match the Storage API's transaction setting; all synthetic metadata is rolled back.
      await tx`SELECT set_config('storage.allow_delete_query', 'true', true)`;
      const owner = randomUUID();
      const other = randomUUID();
      for (const bucket of ["qr-logos", "qr-placement-images", "event-landing-images"]) {
        const id = randomUUID();
        await tx`SELECT set_config('request.jwt.claim.sub', ${owner}, true)`;
        await tx.unsafe("SET LOCAL ROLE authenticated");
        // INSERT-only upload does not require public SELECT.
        await tx`INSERT INTO storage.objects (id, bucket_id, name, owner)
          VALUES (${id}, ${bucket}, ${`security-test/${id}.png`}, ${owner})`;
        expect(await tx`SELECT id FROM storage.objects WHERE id = ${id}`).toHaveLength(1);

        await tx.unsafe("RESET ROLE");
        await tx`SELECT set_config('request.jwt.claim.sub', ${other}, true)`;
        await tx.unsafe("SET LOCAL ROLE authenticated");
        expect(await tx`SELECT id FROM storage.objects WHERE id = ${id}`).toHaveLength(0);
        expect(await tx`DELETE FROM storage.objects WHERE id = ${id} RETURNING id`).toHaveLength(0);

        await tx.unsafe("RESET ROLE");
        await tx.unsafe("SET LOCAL ROLE anon");
        expect(await tx`SELECT id FROM storage.objects WHERE id = ${id}`).toHaveLength(0);

        await tx.unsafe("RESET ROLE");
        await tx`SELECT set_config('request.jwt.claim.sub', ${owner}, true)`;
        await tx.unsafe("SET LOCAL ROLE authenticated");
        expect(await tx`DELETE FROM storage.objects WHERE id = ${id} RETURNING id`).toHaveLength(1);
        await tx.unsafe("RESET ROLE");
        const [settings] = await tx`SELECT public FROM storage.buckets WHERE id = ${bucket}`;
        expect(settings.public).toBe(true);
      }
    });
  });

  it("does not automatically grant client privileges on newly created tables or sequences", async () => {
    await inRollbackTransaction(async (tx) => {
      await tx.unsafe("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated");
      await tx.unsafe("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO PUBLIC, anon, authenticated");
      await tx.unsafe(migration);
      const name = `security_test_${randomUUID().replaceAll("-", "")}`;
      await tx.unsafe(`CREATE TABLE public."${name}" (id serial PRIMARY KEY)`);
      for (const role of ["anon", "authenticated"]) {
        const [privileges] = await tx`
          SELECT has_table_privilege(${role}, ${`public.${name}`}, 'SELECT') AS table_select,
            has_sequence_privilege(${role}, ${`public.${name}_id_seq`}, 'USAGE') AS sequence_usage
        `;
        expect(privileges).toEqual({ table_select: false, sequence_usage: false });
      }
    });
  });
});
