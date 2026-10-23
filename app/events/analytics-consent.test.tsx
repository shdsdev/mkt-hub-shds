// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ children, ...props }: { children?: string; [key: string]: unknown }) => (
    <script {...props}>{children}</script>
  ),
}));

import { AnalyticsConsent } from "./analytics-consent";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  localStorage.clear();
  root = undefined;
  container = undefined;
});

function renderConsent() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<AnalyticsConsent gaId="G-TEST123" />));
}

describe("AnalyticsConsent", () => {
  it("asks for analytics consent before loading Google Analytics", () => {
    renderConsent();

    expect(container?.textContent).toContain("analíticas");
    expect(container?.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it("loads GA4 only after analytics consent is accepted", () => {
    renderConsent();

    const acceptButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Aceptar"),
    );
    act(() => acceptButton?.click());

    expect(container?.querySelector('script[src*="id=G-TEST123"]')).not.toBeNull();
    expect(container?.textContent).not.toContain("Aceptar analíticas");
    expect(localStorage.getItem("marketing-hub-analytics-consent")).toBe("granted");
  });

  it("does not load GA4 after analytics consent is rejected", () => {
    renderConsent();

    const rejectButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("No, gracias"),
    );
    act(() => rejectButton?.click());

    expect(container?.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(localStorage.getItem("marketing-hub-analytics-consent")).toBe("denied");
  });
});
