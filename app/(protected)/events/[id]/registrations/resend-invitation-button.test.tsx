// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { resendInvitationAction } = vi.hoisted(() => ({ resendInvitationAction: vi.fn(() => new Promise(() => {})) }));

vi.mock("./actions", () => ({ resendInvitationAction }));

import { ResendInvitationButton } from "./resend-invitation-button";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

describe("ResendInvitationButton", () => {
  it("only marks the clicked attendee as sending", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <>
        <ResendInvitationButton eventId="event-1" attendeeId="attendee-1" />
        <ResendInvitationButton eventId="event-1" attendeeId="attendee-2" />
      </>,
    ));

    const buttons = () => [...(container?.querySelectorAll<HTMLButtonElement>("button[type='submit']") ?? [])];
    expect(buttons().map((button) => button.textContent)).toEqual(["Reenviar invitación", "Reenviar invitación"]);

    const firstForm = container?.querySelectorAll("form")[0] as HTMLFormElement;
    await act(async () => {
      firstForm.requestSubmit();
    });

    expect(resendInvitationAction).toHaveBeenCalledTimes(1);
    expect(buttons()[0]?.textContent).toBe("Enviando…");
    expect(buttons()[0]?.disabled).toBe(true);
    expect(buttons()[1]?.textContent).toBe("Reenviar invitación");
    expect(buttons()[1]?.disabled).toBe(false);
  });
});
