import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QrScanner } from "./qr-scanner";

describe("QrScanner", () => {
  it("shows that the camera is actively scanning", () => {
    const html = renderToStaticMarkup(
      <QrScanner active onDetected={vi.fn()} onError={vi.fn()} />,
    );

    expect(html).toContain("Escaneando QR");
  });
});
