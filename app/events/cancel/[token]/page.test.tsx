import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRegistrationByCancelToken: vi.fn(),
  getEvent: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/modules/events", () => ({
  getRegistrationByCancelToken: mocks.getRegistrationByCancelToken,
  getEvent: mocks.getEvent,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./confirm-cancel-form", () => ({
  ConfirmCancelForm: ({ token }: { token: string }) => <div data-token={token} />,
}));

import CancelRegistrationPage from "./page";

function makeParams(token: string) {
  return Promise.resolve({ token });
}

describe("CancelRegistrationPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("returns notFound for an unknown cancel token", async () => {
    mocks.getRegistrationByCancelToken.mockResolvedValue(undefined);

    await expect(CancelRegistrationPage({ params: makeParams("unknown") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.getEvent).not.toHaveBeenCalled();
  });

  it("renders the event name and a confirm-cancel form for an active registration", async () => {
    mocks.getRegistrationByCancelToken.mockResolvedValue({
      id: "reg-1",
      eventId: "event-1",
      organizationId: "org-1",
      cancelToken: "cancel-token-1",
      status: "confirmed",
    });
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });

    const result = await CancelRegistrationPage({ params: makeParams("cancel-token-1") });

    expect(mocks.getEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(JSON.stringify(result)).toContain("Workshop de Marketing");
    expect(JSON.stringify(result)).toContain("cancel-token-1");
  });

  it("renders an already-cancelled message without the confirm form for a cancelled registration", async () => {
    mocks.getRegistrationByCancelToken.mockResolvedValue({
      id: "reg-1",
      eventId: "event-1",
      organizationId: "org-1",
      cancelToken: "cancel-token-1",
      status: "cancelled",
    });
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });

    const result = await CancelRegistrationPage({ params: makeParams("cancel-token-1") });

    expect(JSON.stringify(result)).not.toContain("data-token");
  });
});
