import { inspectUnsubscribeRequest, processUnsubscribeRequest } from "@/modules/email-marketing";

type RouteContext = { params: Promise<{ token: string }> };

function responsePage(title: string, message: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f2efe9;color:#15434a;font-family:Arial,sans-serif"><main style="max-width:560px;margin:64px auto;padding:40px 24px;background:#fffcf7;text-align:center"><p style="margin:0 0 12px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#ef6c4d">Shades de México</p><h1 style="margin:0 0 16px;font-size:28px">${title}</h1><p style="margin:0;line-height:1.6">${message}</p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params;
  const result = await inspectUnsubscribeRequest(token);
  if (!result.valid) return responsePage("Enlace no válido", "Este enlace de baja no es válido o ya no está disponible.", 404);
  if (result.alreadyUnsubscribed) return responsePage("Suscripción ya cancelada", "Este contacto ya no recibe campañas de Email Marketing.");
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancelar suscripción</title></head><body style="margin:0;background:#f2efe9;color:#15434a;font-family:Arial,sans-serif"><main style="max-width:560px;margin:64px auto;padding:40px 24px;background:#fffcf7;text-align:center"><p style="margin:0 0 12px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#ef6c4d">Shades de México</p><h1 style="margin:0 0 16px;font-size:28px">¿Querés cancelar tu suscripción?</h1><p style="margin:0;line-height:1.6">Dejarás de recibir campañas de Email Marketing. Los correos transaccionales de eventos pueden continuar llegando.</p><form method="post" style="margin-top:28px"><button type="submit" style="border:0;border-radius:6px;padding:12px 20px;background:#15434a;color:#fff;font-size:15px;cursor:pointer">Confirmar baja</button></form></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params;
  const result = await processUnsubscribeRequest(token);
  if (!result.valid) return responsePage("Enlace no válido", "Este enlace de baja no es válido o ya no está disponible.", 400);
  return responsePage(result.changed ? "Suscripción cancelada" : "Suscripción ya cancelada", "Dejaste de recibir campañas de Email Marketing. Los correos transaccionales de eventos pueden continuar llegando.");
}
