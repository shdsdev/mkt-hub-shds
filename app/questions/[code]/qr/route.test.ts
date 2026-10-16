import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQuestionSessionByCode: vi.fn(),
  exportQrPng: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_ORIGIN: "https://hub.example.com/" } }));
vi.mock("@/modules/questions", () => ({ getQuestionSessionByCode: mocks.getQuestionSessionByCode }));
vi.mock("@/modules/qr", () => ({ exportQrPng: mocks.exportQrPng }));

import { GET } from "./route";

describe("GET /questions/[code]/qr", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getQuestionSessionByCode.mockResolvedValue({ status: "open" });
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
  });

  it("uses the canonical public question URL when the app origin has a trailing slash", async () => {
    await GET(new Request("https://hub.example.com/questions/ABC123/qr"), { params: Promise.resolve({ code: "ABC123" }) });

    expect(mocks.exportQrPng).toHaveBeenCalledWith("https://hub.example.com/questions/ABC123", expect.any(Object));
  });
});
