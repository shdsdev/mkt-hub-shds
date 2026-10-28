export function GET() {
  const csv = "email,full_name,phone,company,tags,subscription_status,consent_source,consented_at,unsubscribed_at\ncontacto@example.com,Nombre Apellido,555-0100,Empresa,\"cliente, evento\",pending,,,\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-contactos-email-marketing.csv"',
    },
  });
}
