type WhatsAppInvitationInput = {
  phone: string;
  attendeeName: string;
  eventName: string;
  backupCode: string;
};

export function normalizePhoneForMessaging(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function buildWhatsAppInvitationUrl(input: WhatsAppInvitationInput): string {
  const message = [
    `Hola ${input.attendeeName},`,
    `te compartimos nuevamente tu invitación para ${input.eventName}.`,
    `Tu folio de acceso es: ${input.backupCode}.`,
    "Te esperamos.",
  ].join("\n");

  return `https://wa.me/${normalizePhoneForMessaging(input.phone)}?text=${encodeURIComponent(message)}`;
}
