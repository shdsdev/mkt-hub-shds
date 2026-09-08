import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTrackingBuffer } from "./buffer";

describe("createTrackingBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not flush immediately on enqueue", () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buffer = createTrackingBuffer({ flush, maxSize: 500, flushIntervalMs: 1000 });

    buffer.enqueue({ id: "1" });

    expect(flush).not.toHaveBeenCalled();
    buffer.stop();
  });

  it("flushes automatically after the interval elapses", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buffer = createTrackingBuffer({ flush, maxSize: 500, flushIntervalMs: 1000 });

    buffer.enqueue({ id: "1" });
    buffer.enqueue({ id: "2" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([{ id: "1" }, { id: "2" }]);
    buffer.stop();
  });

  it("flushes immediately once maxSize is reached, without waiting for the timer", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buffer = createTrackingBuffer({ flush, maxSize: 2, flushIntervalMs: 1000 });

    buffer.enqueue({ id: "1" });
    buffer.enqueue({ id: "2" });
    await vi.advanceTimersByTimeAsync(0);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([{ id: "1" }, { id: "2" }]);
    buffer.stop();
  });

  it("clears the buffer after a successful flush", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buffer = createTrackingBuffer({ flush, maxSize: 500, flushIntervalMs: 1000 });

    buffer.enqueue({ id: "1" });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(flush).toHaveBeenCalledTimes(1);
    buffer.stop();
  });

  it("does not call flush on an empty buffer when the timer fires", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buffer = createTrackingBuffer({ flush, maxSize: 500, flushIntervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(flush).not.toHaveBeenCalled();
    buffer.stop();
  });

  it("logs and drops the batch when flush rejects, without throwing", async () => {
    const flush = vi.fn().mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const buffer = createTrackingBuffer({ flush, maxSize: 500, flushIntervalMs: 1000 });

    buffer.enqueue({ id: "1" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(errorSpy).toHaveBeenCalled();
    buffer.stop();
    errorSpy.mockRestore();
  });
});
