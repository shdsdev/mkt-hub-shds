import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { getQrCode, exportQrPng, exportQrSvg, exportQrPdf } from "@/modules/qr";
import { getShortLink, getDomain } from "@/modules/links";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;
  const qr = await getQrCode(id);
  if (!qr || qr.organizationId !== user.profile.organizationId) {
    return new NextResponse(null, { status: 404 });
  }

  let encodedValue: string;
  if (qr.mode === "dynamic" && qr.shortLinkId) {
    const shortLink = await getShortLink(qr.shortLinkId);
    const domain = shortLink ? await getDomain(shortLink.domainId) : undefined;
    if (!shortLink || !domain) {
      return new NextResponse(null, { status: 404 });
    }
    encodedValue = `https://${domain.hostname}/q/${shortLink.slug}`;
  } else if (qr.staticPayload) {
    encodedValue = qr.staticPayload;
  } else {
    return new NextResponse(null, { status: 404 });
  }

  const rawFormat = request.nextUrl.searchParams.get("format");
  const format = rawFormat === "svg" || rawFormat === "ai" ? rawFormat : "png";
  const customization = {
    backgroundColor: qr.backgroundColor,
    foregroundColor: qr.foregroundColor,
    errorCorrectionLevel: qr.errorCorrectionLevel,
    logoUrl: qr.logoUrl ?? undefined,
    dotsType: qr.dotsType,
    cornersSquareType: qr.cornersSquareType,
    cornersDotType: qr.cornersDotType,
  };

  if (format === "svg") {
    const svg = await exportQrSvg(encodedValue, customization);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="qr-${qr.id}.svg"`,
      },
    });
  }

  // A vector PDF saved under the .ai extension — Illustrator's native format has been PDF-based
  // internally since AI 9, so it opens this as fully editable artwork despite not being a
  // byte-for-byte proprietary .ai file (see exportQrPdf's comment for why that's not achievable
  // without Adobe's own tooling).
  if (format === "ai") {
    const pdf = await exportQrPdf(encodedValue, customization);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-${qr.id}.ai"`,
      },
    });
  }

  const png = await exportQrPng(encodedValue, customization);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${qr.id}.png"`,
    },
  });
}
