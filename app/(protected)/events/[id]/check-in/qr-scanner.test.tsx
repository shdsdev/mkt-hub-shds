// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { callbackStop, decodeFromConstraints } = vi.hoisted(() => ({
  callbackStop: vi.fn(),
  decodeFromConstraints: vi.fn(),
}));

vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints = decodeFromConstraints;
  },
}));

import { QrScanner } from "./qr-scanner";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("QrScanner", () => {
  it("shows that the camera is actively scanning", () => {
    const html = renderToStaticMarkup(
      <QrScanner active onDetected={vi.fn()} onError={vi.fn()} />,
    );

    expect(html).toContain("Escaneando QR");
  });

  it("stops the scanner immediately when ZXing detects a code", async () => {
    const onDetected = vi.fn();
    decodeFromConstraints.mockImplementation((_constraints, _video, callback) => {
      callback({ getText: () => "pass-token" }, undefined, { stop: callbackStop });
      return new Promise(() => undefined);
    });

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<QrScanner active onDetected={onDetected} onError={vi.fn()} />);
    });

    expect(onDetected).toHaveBeenCalledWith("pass-token");
    expect(callbackStop).toHaveBeenCalledOnce();
    root.unmount();
  });
});
