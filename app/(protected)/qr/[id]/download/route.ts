import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { getQrCode, exportQrPng, exportQrSvg } from "@/modules/qr";
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

  const format = request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";
  const customization = {
    backgroundColor: qr.backgroundColor,
    foregroundColor: qr.foregroundColor,
    errorCorrectionLevel: qr.errorCorrectionLevel,
    logoUrl: qr.logoUrl ?? undefined,
  };

  if (format === "svg") {
    if (qr.logoUrl) {
      return new NextResponse("SVG export is not available for a QR code with a logo.", {
        status: 400,
      });
    }
    const svg = await exportQrSvg(encodedValue, customization);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="qr-${qr.id}.svg"`,
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
