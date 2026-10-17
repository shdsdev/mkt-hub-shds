import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getQuestionSessionByCode } from "@/modules/questions";
import { exportQrPng } from "@/modules/qr";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getQuestionSessionByCode(code);
  if (!session || session.status !== "open") return new NextResponse(null, { status: 404 });

  const appOrigin = env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/+$/, "");
  const encodedValue = `${appOrigin}/questions/${encodeURIComponent(code)}`;
  const png = await exportQrPng(encodedValue, {
    backgroundColor: "#ffffff",
    foregroundColor: "#111111",
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
