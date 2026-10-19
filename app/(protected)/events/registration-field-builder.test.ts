import { describe, expect, it } from "vitest";
import type { RegistrationCustomField } from "@/modules/events";
import {
  addCustomField,
  moveCustomField,
  removeCustomField,
  updateCustomField,
} from "./registration-field-builder";

describe("registration field builder operations", () => {
  it("adds a field with a unique id and position", () => {
    const first = addCustomField([], "short_text");
    const fields = addCustomField(first, "short_text");

    expect(fields).toHaveLength(2);
    expect(fields.map((field) => field.position)).toEqual([0, 1]);
    expect(new Set(fields.map((field) => field.id)).size).toBe(2);
  });

  it("updates and removes a custom field without changing other fields", () => {
    const fields = addCustomField(addCustomField([], "short_text"), "checkbox");
    const updated = updateCustomField(fields, fields[0].id, { label: "Empresa" });
    const remaining = removeCustomField(updated, fields[1].id);

    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: fields[0].id, label: "Empresa", position: 0 });
  });

  it("moves fields and normalizes positions", () => {
    const fields = ["short_text", "number", "date"].reduce(
      (current, type) => addCustomField(current, type as "short_text" | "number" | "date"),
      [] as RegistrationCustomField[],
    );

    const moved = moveCustomField(fields, fields[2].id, 0);

    expect(moved.map((field) => field.type)).toEqual(["date", "short_text", "number"]);
    expect(moved.map((field) => field.position)).toEqual([0, 1, 2]);
  });
});
