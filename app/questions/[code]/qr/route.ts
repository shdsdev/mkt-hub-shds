import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getQuestionSessionByCode } from "@/modules/questions";
import { exportQrSvg } from "@/modules/qr";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getQuestionSessionByCode(code);
  if (!session || session.status !== "open") return new NextResponse(null, { status: 404 });

  const encodedValue = `${env.NEXT_PUBLIC_APP_ORIGIN}/questions/${encodeURIComponent(code)}`;
  const svg = await exportQrSvg(encodedValue, {
    backgroundColor: "#ffffff",
    foregroundColor: "#111111",
    errorCorrectionLevel: "M",
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, no-store",
    },
  });
}
