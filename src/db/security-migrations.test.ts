import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const journal = JSON.parse(readFileSync(resolve("drizzle/meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const migrations = journal.entries.map(({ tag }) =>
  readFileSync(resolve("drizzle", `${tag}.sql`), "utf8").replace(/--[^\n]*/g, ""),
);
const sql = migrations.join("\n");

describe("database security migrations", () => {
  it("enables RLS on every public table, including partitions", () => {
    const tables = [...sql.matchAll(/CREATE TABLE (?:"public"\.)?"([^"]+)"/gi)]
      .map((match) => match[1]);
    expect(tables.length).toBeGreaterThan(40);
    const unprotected = tables.filter((table) => {
      const changes = [...sql.matchAll(new RegExp(
        `ALTER TABLE (?:"public"\\.)?"${table}" (ENABLE|DISABLE) ROW LEVEL SECURITY`, "gi",
      ))];
      return changes.at(-1)?.[1].toUpperCase() !== "ENABLE";
    });
    expect(unprotected).toEqual([]);
  });

  it("replaces broad public bucket listing with authenticated owner-only reads", () => {
    for (const prefix of ["event_landing_images", "qr_logos", "qr_placement_images"]) {
      const broadPolicy = `${prefix}_select_public`;
      expect(sql.lastIndexOf(`DROP POLICY IF EXISTS "${broadPolicy}"`))
        .toBeGreaterThan(sql.lastIndexOf(`CREATE POLICY "${broadPolicy}"`));
      expect(sql).toMatch(new RegExp(
        `CREATE POLICY "${prefix}_select_owner" ON storage\\.objects\\s+FOR SELECT TO authenticated\\s+USING \\(bucket_id = '[^']+' AND owner = \\(SELECT auth\\.uid\\(\\)\\)\\)`,
      ));
    }
  });

  it("removes implicit client grants for future public tables and sequences", () => {
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL (?:PRIVILEGES )?ON TABLES FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL (?:PRIVILEGES )?ON SEQUENCES FROM PUBLIC, anon, authenticated/i);
  });
});
