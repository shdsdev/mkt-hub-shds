import { describe, expect, it } from "vitest";
import { getPostgresOptions } from "./connection";

describe("getPostgresOptions", () => {
  it("disables prepared statements for Supabase Transaction Pooler", () => {
    expect(getPostgresOptions("postgresql://user:password@pooler.supabase.com:6543/postgres")).toEqual({
      ssl: "require",
      prepare: false,
    });
  });

  it("keeps prepared statements enabled for a direct production connection", () => {
    expect(getPostgresOptions("postgresql://user:password@db.supabase.co:5432/postgres")).toEqual({
      ssl: "require",
    });
  });

  it("does not require TLS for the local Supabase database", () => {
    expect(getPostgresOptions("postgresql://postgres:postgres@127.0.0.1:54322/postgres")).toEqual({
      ssl: false,
    });
  });
});
