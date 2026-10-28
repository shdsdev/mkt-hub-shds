"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, deactivateEventBenefit, annulBenefitRedemption, listEventBenefits, saveEventBenefit, saveEventBenefitsConfiguration, setEventBenefitRedemptionScope } from "@/modules/events";
import { isActive } from "@/modules/users";

export type BenefitActionState = { ok?: boolean; benefits?: unknown[]; success?: string; error?: string };
const uuid = z.string().uuid();
const eventSchema = z.object({ eventId: uuid });

function value(formData: FormData, key: string) { return formData.get(key) ?? undefined; }
function route(eventId: string) { return `/events/${eventId}/edit`; }

async function requireManager(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return undefined;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "benefit-management" }))) return undefined;
  return user;
}

function unauthorized(): BenefitActionState { return { error: "No tienes permiso para administrar los beneficios." }; }
function resultError(reason: string) {
  if (reason === "scope_locked") return "El alcance no puede cambiarse después del primer canje.";
  if (reason === "gift_name_required") return "Indica el nombre del regalo.";
  if (reason === "discount_percentage_required" || reason === "invalid_percentage") return "Indica un porcentaje de descuento válido.";
  if (reason === "invalid_quantity") return "Indica una cantidad válida.";
  if (reason === "configuration_invalid") return "Revisa la configuración de los beneficios.";
  if (reason === "already_annulled") return "El canje ya fue anulado.";
  return "No se encontró el beneficio o canje solicitado.";
}

const benefitConfigurationSchema = z.object({
  scope: z.enum(["attendee", "registration"]),
  benefits: z.array(z.discriminatedUnion("kind", [
    z.object({
      id: uuid.optional(),
      kind: z.literal("gift"),
      name: z.string().trim().min(1).max(255),
      percentage: z.nullable(z.number().int()).optional(),
      quantity: z.nullable(z.number().int().min(0)),
      active: z.boolean(),
    }),
    z.object({
      id: uuid.optional(),
      kind: z.literal("discount"),
      name: z.string().trim().max(255).nullable().optional(),
      percentage: z.number().int().min(0).max(100),
      quantity: z.nullable(z.number().int().min(0)),
      active: z.boolean(),
    }),
  ])),
});

function parseConfiguration(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export async function saveBenefitsConfigurationAction(formData: FormData): Promise<BenefitActionState> {
  const parsed = eventSchema.extend({ configuration: benefitConfigurationSchema }).safeParse({
    eventId: value(formData, "eventId"),
    configuration: parseConfiguration(formData.get("configuration")),
  });
  if (!parsed.success) return { error: "Revisa la configuración de los beneficios." };
  const user = await requireManager(parsed.data.eventId);
  if (!user) return unauthorized();
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };
  const result = await saveEventBenefitsConfiguration({
    eventId: parsed.data.eventId,
    scope: parsed.data.configuration.scope,
    benefits: parsed.data.configuration.benefits.map(({ id, ...benefit }) => ({ ...benefit, benefitId: id })),
  });
  if (!result.ok) return { error: resultError(result.reason) };
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    eventId: parsed.data.eventId,
    action: "create",
    resourceType: "event_benefit_configuration",
    resourceId: parsed.data.eventId,
    after: parsed.data.configuration,
  });
  revalidatePath(route(parsed.data.eventId));
  return { success: "Cambios guardados correctamente." };
}

export async function listBenefitsAction(formData: FormData): Promise<BenefitActionState> {
  const parsed = eventSchema.safeParse({ eventId: value(formData, "eventId") });
  if (!parsed.success) return { error: "Evento inválido." };
  if (!(await requireManager(parsed.data.eventId))) return unauthorized();
  return { ok: true, benefits: await listEventBenefits(parsed.data.eventId) };
}

const benefitSchema = eventSchema.extend({
  benefitId: uuid.optional(),
  kind: z.enum(["gift", "discount"]),
  name: z.string().trim().max(255).optional().or(z.literal("")),
  percentage: z.coerce.number().int().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  active: z.enum(["true", "false"]).default("true"),
});

export async function createBenefitAction(formData: FormData): Promise<BenefitActionState> { return saveBenefitAction(formData); }
export async function updateBenefitAction(formData: FormData): Promise<BenefitActionState> { return saveBenefitAction(formData); }

async function saveBenefitAction(formData: FormData): Promise<BenefitActionState> {
  const parsed = benefitSchema.safeParse({ eventId: value(formData, "eventId"), benefitId: value(formData, "benefitId") || undefined, kind: value(formData, "kind"), name: value(formData, "name") || undefined, percentage: value(formData, "percentage") || undefined, quantity: value(formData, "quantity") || undefined, active: value(formData, "active") || "true" });
  if (!parsed.success) return { error: "Revisa la configuración del beneficio." };
  const user = await requireManager(parsed.data.eventId);
  if (!user) return unauthorized();
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };
  const result = await saveEventBenefit({ ...parsed.data, active: parsed.data.active === "true", name: parsed.data.name || null, percentage: parsed.data.percentage ?? null, quantity: parsed.data.quantity ?? null });
  if (!result.ok) return { error: resultError(result.reason) };
   await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, eventId: parsed.data.eventId, action: "create", resourceType: "event_benefit", resourceId: result.benefit.id, after: parsed.data });
  revalidatePath(route(parsed.data.eventId));
  return { success: "Beneficio guardado correctamente." };
}

export async function deactivateBenefitAction(formData: FormData): Promise<BenefitActionState> {
  const parsed = eventSchema.extend({ benefitId: uuid }).safeParse({ eventId: value(formData, "eventId"), benefitId: value(formData, "benefitId") });
  if (!parsed.success) return { error: "Beneficio inválido." };
  const user = await requireManager(parsed.data.eventId);
  if (!user) return unauthorized();
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };
  const result = await deactivateEventBenefit(parsed.data);
  if (!result.ok) return { error: resultError(result.reason) };
   await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, eventId: parsed.data.eventId, action: "create", resourceType: "event_benefit", resourceId: result.benefit.id, after: { active: false } });
  revalidatePath(route(parsed.data.eventId));
  return { success: "Beneficio desactivado correctamente." };
}

export async function updateBenefitScopeAction(formData: FormData): Promise<BenefitActionState> {
  const parsed = eventSchema.extend({ scope: z.enum(["attendee", "registration"]) }).safeParse({ eventId: value(formData, "eventId"), scope: value(formData, "scope") });
  if (!parsed.success) return { error: "Selecciona un alcance válido." };
  const user = await requireManager(parsed.data.eventId);
  if (!user) return unauthorized();
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };
  const result = await setEventBenefitRedemptionScope(parsed.data);
  if (!result.ok) return { error: resultError(result.reason) };
   await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, eventId: parsed.data.eventId, action: "create", resourceType: "event", resourceId: parsed.data.eventId, after: { benefitRedemptionScope: parsed.data.scope } });
  revalidatePath(route(parsed.data.eventId));
  return { success: "Alcance de canje actualizado correctamente." };
}

export async function annulBenefitRedemptionAction(formData: FormData): Promise<BenefitActionState> {
  const parsed = eventSchema.extend({ redemptionId: uuid, reason: z.string().trim().min(1).max(1000) }).safeParse({ eventId: value(formData, "eventId"), redemptionId: value(formData, "redemptionId"), reason: value(formData, "reason") });
  if (!parsed.success) return { error: "Indica el motivo de la anulación." };
  const user = await requireManager(parsed.data.eventId);
  if (!user) return unauthorized();
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };
  const result = await annulBenefitRedemption({ eventId: parsed.data.eventId, redemptionId: parsed.data.redemptionId, actorId: user.id, reason: parsed.data.reason });
  if (!result.ok) return { error: resultError(result.reason) };
   await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, eventId: parsed.data.eventId, action: "create", resourceType: "event_benefit_redemption", resourceId: result.redemption.id, after: { reason: parsed.data.reason, status: "annulled" } });
  revalidatePath(route(parsed.data.eventId));
  return { success: "Canje anulado correctamente." };
}
