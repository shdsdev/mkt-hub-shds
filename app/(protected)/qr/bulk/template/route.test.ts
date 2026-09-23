import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("@/modules/auth", () => ({ getCurrentUser }));

import { BULK_QR_TEMPLATE_CSV, BULK_QR_TEMPLATE_FILENAME } from "./constants";
import { GET } from "./route";

describe("GET /qr/bulk/template", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects an unauthenticated request", async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
  });

  it("returns the documented CSV as a download for authenticated users", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1" });

    const response = await GET();

    expect(BULK_QR_TEMPLATE_FILENAME).toBe("plantilla_codigos_qr.csv");
    expect(BULK_QR_TEMPLATE_CSV).toBe(
      "url,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content\r\n" +
        "https://www.example.com,QR example,google,email,fall_launch,,hero\r\n",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="plantilla_codigos_qr.csv"',
    );
    expect(await response.text()).toBe(BULK_QR_TEMPLATE_CSV);
  });
});
