export const COMPANION_EMAIL_ERROR = "El correo del acompañante no puede ser igual al del titular.";
export const COMPANION_PHONE_ERROR = "El teléfono del acompañante no puede ser igual al del titular.";

type CompanionContactValues = {
  primaryEmail: string;
  companionEmail: string;
  primaryPhone: string;
  companionPhone: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function getCompanionContactErrors({
  primaryEmail,
  companionEmail,
  primaryPhone,
  companionPhone,
}: CompanionContactValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (companionEmail.trim() && normalizeEmail(primaryEmail) === normalizeEmail(companionEmail)) {
    errors.companionEmail = COMPANION_EMAIL_ERROR;
  }

  const normalizedPrimaryPhone = normalizePhone(primaryPhone);
  const normalizedCompanionPhone = normalizePhone(companionPhone);
  if (normalizedCompanionPhone && normalizedPrimaryPhone === normalizedCompanionPhone) {
    errors.companionPhone = COMPANION_PHONE_ERROR;
  }

  return errors;
}
