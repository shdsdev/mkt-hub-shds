// In-process buffered batch insert (ARCHITECTURE.md). Valid because the app deploys as one
// persistent Node container (not serverless/edge) — the buffer's lifetime is the process's.
export type TrackingBuffer<T> = {
  enqueue: (event: T) => void;
  flush: () => Promise<void>;
  stop: () => void;
};

export function createTrackingBuffer<T>(options: {
  flush: (events: T[]) => Promise<void>;
  maxSize: number;
  flushIntervalMs: number;
}): TrackingBuffer<T> {
  let queue: T[] = [];

  async function doFlush(): Promise<void> {
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    try {
      await options.flush(batch);
    } catch (error) {
      // Analytics is best-effort (NFR-05) — never retry at the cost of the redirect path.
      console.error("[analytics] tracking batch dropped:", error);
    }
  }

  const timer = setInterval(() => {
    void doFlush();
  }, options.flushIntervalMs);

  function enqueue(event: T): void {
    queue.push(event);
    if (queue.length >= options.maxSize) {
      void doFlush();
    }
  }

  function stop(): void {
    clearInterval(timer);
  }

  return { enqueue, flush: doFlush, stop };
}
