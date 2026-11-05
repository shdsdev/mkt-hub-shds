import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("@/db/client", () => ({ db: mocks }));

import { buildTemplateTree, listChecklistTemplates } from "./checklist-template-service";

function chain<T>(rows: T[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { orderBy, limit });
  const where = vi.fn().mockReturnValue(whereResult);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, orderBy, limit };
}

describe("buildTemplateTree", () => {
  it("nests subtasks under their parent task", () => {
    const groups = [{ id: "group-1", templateId: "template-1", title: "Hotel", position: 0 }];
    const tasks = [
      { id: "task-1", groupId: "group-1", parentTaskId: null, title: "Reservar", notes: null, position: 0 },
      { id: "subtask-1", groupId: "group-1", parentTaskId: "task-1", title: "Confirmar", notes: null, position: 0 },
    ];

    const tree = buildTemplateTree(groups, tasks);

    expect(tree[0].tasks).toHaveLength(1);
    expect(tree[0].tasks[0].subtasks.map((subtask) => subtask.id)).toEqual(["subtask-1"]);
  });
});

describe("listChecklistTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts groups and tasks per template", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: "template-1", organizationId: "org-1", name: "Boda", createdAt: new Date("2026-01-01") }]))
      .mockReturnValueOnce(chain([
        { id: "group-1", templateId: "template-1", title: "Hotel", position: 0 },
        { id: "group-2", templateId: "template-1", title: "Sala", position: 1 },
      ]))
      .mockReturnValueOnce(chain([
        { id: "task-1", groupId: "group-1" },
        { id: "subtask-1", groupId: "group-1" },
        { id: "task-2", groupId: "group-2" },
      ]));

    await expect(listChecklistTemplates("org-1")).resolves.toEqual([
      { id: "template-1", name: "Boda", groupCount: 2, taskCount: 3, createdAt: new Date("2026-01-01") },
    ]);
  });

  it("returns an empty list without extra queries", async () => {
    mocks.select.mockReturnValueOnce(chain([]));

    await expect(listChecklistTemplates("org-1")).resolves.toEqual([]);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
