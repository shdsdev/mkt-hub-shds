import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: { admin: {} } })));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { createAdminClient } from "./admin-client";

describe("createAdminClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  it("can be loaded by a Node script without server-only", () => {
    createAdminClient();

    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "service-role-key", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });
});
