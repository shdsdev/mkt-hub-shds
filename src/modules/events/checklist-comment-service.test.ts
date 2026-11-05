import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));

vi.mock("@/db/client", () => ({ db: mocks }));

import { createChecklistComment, listEventChecklistComments } from "./checklist-comment-service";

function chain<T>(rows: T[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { orderBy, limit });
  const where = vi.fn().mockReturnValue(whereResult);
  const leftJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ where, leftJoin });
  return { from, where, leftJoin, orderBy, limit };
}

describe("checklist comment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists event comments with the author email", async () => {
    const rows = [{ id: "comment-1", taskId: "task-1", authorId: "user-1", authorEmail: "ada@example.com", body: "Listo", createdAt: new Date("2026-11-04") }];
    mocks.select.mockReturnValueOnce(chain(rows));

    await expect(listEventChecklistComments("event-1", "org-1")).resolves.toEqual(rows);
  });

  it("creates a comment after scoping the task to the event and organization", async () => {
    const created = { id: "comment-1", taskId: "task-1", organizationId: "org-1", eventId: "event-1", authorId: "user-1", body: "Listo", createdAt: new Date("2026-11-04") };
    mocks.select.mockReturnValueOnce(chain([{ id: "task-1" }]));
    mocks.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([created]) }),
    });

    await expect(createChecklistComment({ taskId: "task-1", eventId: "event-1", organizationId: "org-1", authorId: "user-1", body: "Listo" })).resolves.toEqual({ ok: true, value: created });
    expect(mocks.insert).toHaveBeenCalledOnce();
  });

  it("rejects a comment when the task is not in scope", async () => {
    mocks.select.mockReturnValueOnce(chain([]));

    await expect(createChecklistComment({ taskId: "task-1", eventId: "event-1", organizationId: "org-1", authorId: "user-1", body: "Listo" })).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
