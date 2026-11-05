import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}));
const updateSets: Array<Record<string, unknown>> = [];

vi.mock("@/db/client", () => ({ db: mocks }));

import { bulkDeleteChecklistTasks, bulkUpdateChecklistTasks, deleteChecklistTask, duplicateChecklistTask, listDueChecklistReminders, moveChecklistTask, reorderChecklistItems, updateChecklistTask } from "./checklist-service";

const input = {
  id: "task-1",
  eventId: "event-1",
  organizationId: "org-1",
};

function queryReturning<T>(rows: T[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue(
    Object.assign(Promise.resolve(rows), { limit, returning: vi.fn().mockResolvedValue(rows) }),
  );
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, limit };
}

function queryParameters(query: unknown) {
  return new PgDialect().sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]).params;
}

function queryOrdered<T>(rows: T[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, orderBy };
}

function configureTransaction(...queries: Array<{ from: ReturnType<typeof vi.fn> }>) {
  const tx = {
    select: vi.fn(),
    update: mocks.update,
    insert: mocks.insert,
    delete: mocks.delete,
  };
  for (const query of queries) tx.select.mockReturnValueOnce(query);
  mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateSets.length = 0;
  mocks.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
  });
  mocks.delete.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
  });
  mocks.update.mockReturnValue({
    set: vi.fn((values) => {
      updateSets.push(values);
      return {
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      };
    }),
  });
});

describe("reorderChecklistItems", () => {
  it("moves an item within one ordered list without mutating the input", () => {
    const source = ["first", "second", "third"];

    expect(reorderChecklistItems(source, 0, 2)).toEqual(["second", "third", "first"]);
    expect(source).toEqual(["first", "second", "third"]);
  });

  it("returns the original ordering for invalid indexes", () => {
    const source = ["first", "second"];

    expect(reorderChecklistItems(source, -1, 1)).toEqual(source);
    expect(reorderChecklistItems(source, 0, 4)).toEqual(source);
  });
});

describe("updateChecklistTask completion invariants", () => {
  it("rejects completing a parent while a subtask is pending", async () => {
    const pendingQuery = queryReturning([{ id: "subtask-1", completed: false }]);
    configureTransaction(
      queryReturning([{ id: input.id, parentTaskId: null }]),
      pendingQuery,
    );

    await expect(updateChecklistTask({ ...input, completed: true })).resolves.toEqual({
      ok: false,
      reason: "pending_subtasks",
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(queryParameters(pendingQuery.where.mock.calls[0][0])).toEqual([
      input.id,
      false,
      input.eventId,
      input.organizationId,
    ]);
  });

  it("automatically completes the parent after the last subtask completes", async () => {
    const parentUpdateWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const tx = configureTransaction(
      queryReturning([{ id: input.id, parentTaskId: "parent-1" }]),
      queryReturning([{ id: input.id, completed: true }]),
    );
    mocks.update
      .mockReturnValueOnce({
        set: vi.fn((values) => {
          updateSets.push(values);
          return {
           where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...input, completed: true }]) }),
          };
        }),
      })
      .mockReturnValueOnce({
        set: vi.fn((values) => {
          updateSets.push(values);
          return { where: parentUpdateWhere };
        }),
      });

    await expect(updateChecklistTask({ ...input, completed: true })).resolves.toMatchObject({ ok: true });
    expect(tx.select).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(updateSets[1]).toMatchObject({ completed: true });
    expect(queryParameters(parentUpdateWhere.mock.calls[0][0])).toEqual([
      "parent-1",
      input.eventId,
      input.organizationId,
    ]);
  });

  it("reopens the parent when a subtask is reopened", async () => {
    const tx = configureTransaction(
      queryReturning([{ id: input.id, parentTaskId: "parent-1" }]),
      queryReturning([{ id: input.id, completed: false }]),
    );
    mocks.update
      .mockReturnValueOnce({
        set: vi.fn((values) => {
          updateSets.push(values);
          return {
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...input, completed: false }]) }),
          };
        }),
      })
      .mockReturnValueOnce({
        set: vi.fn((values) => {
          updateSets.push(values);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) };
        }),
      });

    await expect(updateChecklistTask({ ...input, completed: false })).resolves.toMatchObject({ ok: true });
    expect(tx.select).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(updateSets[1]).toMatchObject({ completed: false });
  });
});

describe("optimistic version checks", () => {
  const expectedUpdatedAt = "2026-01-01T00:00:00.000Z";

  it("rejects an update when another user changed the task", async () => {
    configureTransaction(queryReturning([{ id: input.id, parentTaskId: null, updatedAt: new Date("2026-01-02T00:00:00.000Z") }]));

    await expect(updateChecklistTask({ ...input, title: "Cambio", expectedUpdatedAt })).resolves.toEqual({
      ok: false,
      reason: "conflict",
    });
  });

  it("rejects a delete when the task version is stale", async () => {
    configureTransaction(queryReturning([{ groupId: "group-1", parentTaskId: null }]));

    await expect(deleteChecklistTask({ ...input, expectedUpdatedAt })).resolves.toEqual({
      ok: false,
      reason: "conflict",
    });
  });

  it("rejects a move when the task version is stale", async () => {
    configureTransaction(
      queryReturning([{ groupId: "group-1", parentTaskId: null }]),
      queryReturning([{ id: "group-2" }]),
    );

    await expect(moveChecklistTask({ ...input, destinationGroupId: "group-2", destinationIndex: 0, expectedUpdatedAt })).resolves.toEqual({
      ok: false,
      reason: "conflict",
    });
  });

  it("rejects a bulk update when one task version is stale", async () => {
    configureTransaction(queryReturning([{ id: input.id, parentTaskId: null }]));

    await expect(bulkUpdateChecklistTasks({ ids: [input.id], eventId: input.eventId, organizationId: input.organizationId, completed: false, expectedUpdatedAtById: { [input.id]: expectedUpdatedAt } })).resolves.toEqual({
      ok: false,
      reason: "conflict",
    });
  });
});

describe("duplicateChecklistTask", () => {
  it("duplicates a top-level task and its subtasks as pending copies", async () => {
    const source = {
      id: "task-1",
      organizationId: "org-1",
      eventId: "event-1",
      groupId: "group-1",
      parentTaskId: null,
      title: "Montar escenario",
      completed: true,
      assigneeId: "user-1",
      priority: "medium" as const,
      dueDate: "2026-11-10",
      notes: "Antes de las 8",
      createdBy: null,
      completedAt: new Date("2026-01-02"),
      completedBy: null,
      position: 2,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    const copy = { ...source, id: "task-copy", title: "Montar escenario (copia)", completed: false, position: 4 };
    const subtask = { ...source, id: "subtask-1", parentTaskId: "task-1", title: "Colgar luces", position: 0 };
    const inserted: unknown[] = [];

    configureTransaction(
      queryReturning([source]),
      queryReturning([{ position: 3 }]),
      queryOrdered([subtask]),
    );
    mocks.insert
      .mockReturnValueOnce({
        values: vi.fn((values) => {
          inserted.push(values);
          return { returning: vi.fn().mockResolvedValue([copy]) };
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn((values) => {
          inserted.push(values);
          return { returning: vi.fn().mockResolvedValue([]) };
        }),
      });

    await expect(duplicateChecklistTask({ id: "task-1", eventId: "event-1", organizationId: "org-1" })).resolves.toEqual({
      ok: true,
      value: copy,
    });
    expect(inserted[0]).toMatchObject({ title: "Montar escenario (copia)", completed: false, position: 4 });
    expect(inserted[1]).toEqual([
      expect.objectContaining({ parentTaskId: "task-copy", title: "Colgar luces", completed: false, position: 0 }),
    ]);
  });

  it("rejects duplicating a subtask", async () => {
    configureTransaction(queryReturning([]));

    await expect(duplicateChecklistTask({ id: "subtask-1", eventId: "event-1", organizationId: "org-1" })).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("listDueChecklistReminders", () => {
  it("returns incomplete assigned tasks with event context", async () => {
    const rows = [
      {
        id: "task-1",
        organizationId: "org-1",
        eventId: "event-1",
        eventName: "Boda Garcia",
        title: "Confirmar proveedores",
        dueDate: "2026-11-03",
        assigneeId: "user-1",
      },
    ];
    const innerJoin = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) });
    mocks.select.mockReturnValue({ from: vi.fn().mockReturnValue({ innerJoin }) });

    await expect(listDueChecklistReminders("2026-11-04")).resolves.toEqual(rows);
  });
});

describe("bulk checklist task operations", () => {
  it("updates tasks and skips parents with pending subtasks", async () => {
    configureTransaction(
      queryReturning([{ id: "task-1", parentTaskId: null }]),
      queryReturning([{ id: "subtask-1" }]),
      queryReturning([{ id: "task-2", parentTaskId: null }]),
      queryReturning([]),
    );
    mocks.update.mockReturnValueOnce({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "task-2" }]) })) })),
    });

    await expect(bulkUpdateChecklistTasks({ ids: ["task-1", "task-2"], eventId: "event-1", organizationId: "org-1", completed: true })).resolves.toEqual({
      ok: true,
      value: { updated: 1, skipped: 1 },
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("deletes only the scoped selected tasks", async () => {
    mocks.transaction.mockImplementationOnce(async (callback) => callback({ delete: mocks.delete }));
    mocks.delete.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "task-1" }]) }) });

    await expect(bulkDeleteChecklistTasks({ ids: ["task-1"], eventId: "event-1", organizationId: "org-1" })).resolves.toEqual({
      ok: true,
      value: { deleted: 1 },
    });
  });
});
