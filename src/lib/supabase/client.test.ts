import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser Supabase client", () => {
  it("uses statically analyzable public environment variable references", () => {
    const source = readFileSync(new URL("./client.ts", import.meta.url), "utf8");

    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(source).not.toContain('from "@/lib/env"');
  });
});
