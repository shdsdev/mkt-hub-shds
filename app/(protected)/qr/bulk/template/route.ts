import { getCurrentUser } from "@/modules/auth";
import { BULK_QR_TEMPLATE_CSV, BULK_QR_TEMPLATE_FILENAME } from "./constants";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  return new Response(BULK_QR_TEMPLATE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${BULK_QR_TEMPLATE_FILENAME}"`,
    },
  });
}
