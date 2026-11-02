import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inspectUnsubscribeRequest: vi.fn(),
  processUnsubscribeRequest: vi.fn(),
}));

vi.mock("@/modules/email-marketing", () => mocks);

import { GET, POST } from "./route";

describe("unsubscribe landing", () => {
  it("does not unsubscribe on GET and renders a confirmation form", async () => {
    mocks.inspectUnsubscribeRequest.mockResolvedValue({ valid: true, alreadyUnsubscribed: false });

    const response = await GET(new Request("https://shmx.men/email/unsubscribe/token-1"), { params: Promise.resolve({ token: "token-1" }) });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('method="post"');
    expect(html).toContain("Confirmar baja");
    expect(mocks.processUnsubscribeRequest).not.toHaveBeenCalled();
  });

  it("processes the unsubscribe only on POST", async () => {
    mocks.processUnsubscribeRequest.mockResolvedValue({ valid: true, changed: true });

    const response = await POST(new Request("https://shmx.men/email/unsubscribe/token-1"), { params: Promise.resolve({ token: "token-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.processUnsubscribeRequest).toHaveBeenCalledWith("token-1");
  });
});
