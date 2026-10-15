import { describe, expect, it } from "vitest";
import {
  combineDateTimeLocal,
  combineOptionalDateTimeLocal,
  getOptionalDateTimeError,
  splitDateTimeLocal,
} from "./event-date-time";

describe("event local date/time helpers", () => {
  it("splits a Date into date and time values for native inputs", () => {
    expect(splitDateTimeLocal(new Date(2026, 9, 13, 14, 29))).toEqual({
      date: "2026-10-13",
      time: "14:29",
    });
  });

  it("combines required date and time values into datetime-local format", () => {
    expect(combineDateTimeLocal("2026-10-13", "14:29")).toBe("2026-10-13T14:29");
  });

  it("returns an empty value when the optional end date/time is blank", () => {
    expect(combineOptionalDateTimeLocal("", "")).toBe("");
  });

  it("does not silently accept only one optional end value", () => {
    expect(() => combineOptionalDateTimeLocal("2026-10-13", "")).toThrow(
      "La fecha y hora de finalización deben completarse juntas.",
    );
  });

  it("returns an inline validation message for a partial optional end", () => {
    expect(getOptionalDateTimeError("2026-10-13", "")).toBe(
      "La fecha y hora de finalización deben completarse juntas.",
    );
    expect(getOptionalDateTimeError("", "14:29")).toBe(
      "La fecha y hora de finalización deben completarse juntas.",
    );
    expect(getOptionalDateTimeError("", "")).toBeNull();
  });
});
