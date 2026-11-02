import { describe, expect, it } from "vitest";
import { normalizeEmailContactListOptions } from "./contact-list-options";

describe("email contact list options", () => {
  it("normalizes page, size, search, and status", () => {
    expect(normalizeEmailContactListOptions({ page: "0", pageSize: "1000", q: "  Maya ", status: "subscribed", sort: "name_desc" })).toEqual({
      page: 1,
      pageSize: 100,
      search: "Maya",
      status: "subscribed",
      sort: "name_desc",
    });
  });
});
