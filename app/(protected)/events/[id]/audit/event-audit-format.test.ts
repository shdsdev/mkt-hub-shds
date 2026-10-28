import { describe, expect, it } from "vitest";
import { summarizeAuditLog } from "./event-audit-format";

describe("summarizeAuditLog", () => {
  it("describes simple field changes in plain language", () => {
    const summary = summarizeAuditLog({
      action: "event_change",
      resourceType: "event",
      before: { capacity: 50, name: "Shades Spaces" },
      after: { capacity: 100, name: "Shades Spaces GDL" },
    });

    expect(summary.headline).toBe("Editó el evento");
    expect(summary.changes).toContainEqual({ label: "Capacidad", from: "50", to: "100" });
    expect(summary.changes).toContainEqual({ label: "Nombre", from: "Shades Spaces", to: "Shades Spaces GDL" });
  });

  it("formats dates and booleans for humans", () => {
    const summary = summarizeAuditLog({
      action: "event_change",
      resourceType: "event",
      before: { checkInConfirmationRequired: true },
      after: { checkInConfirmationRequired: false },
    });

    expect(summary.changes).toContainEqual({
      label: "Confirmación de check-in",
      from: "Sí",
      to: "No",
    });
  });

  it("explains registration form changes without technical keys", () => {
    const summary = summarizeAuditLog({
      action: "event_change",
      resourceType: "event",
      before: { registrationFormConfig: { fields: { phone: { visible: true, required: false } } } },
      after: { registrationFormConfig: { fields: { phone: { visible: true, required: true } } } },
    });

    expect(summary.changes).toContainEqual({
      label: "Formulario: Teléfono obligatorio",
      from: "No",
      to: "Sí",
    });
  });

  it("describes successful and failed sends with the recipient", () => {
    expect(summarizeAuditLog({
      action: "event_send",
      resourceType: "event_notification",
      before: null,
      after: { kind: "confirmation", recipient: "ana@example.com", result: "sent" },
    }).headline).toBe("Envió la confirmación a ana@example.com");

    expect(summarizeAuditLog({
      action: "event_send_failed",
      resourceType: "event_notification",
      before: null,
      after: { kind: "reminder", recipient: "luis@example.com", result: "failed" },
    }).headline).toBe("No se pudo enviar el recordatorio a luis@example.com");
  });

  it("describes send details without technical field names", () => {
    const summary = summarizeAuditLog({
      action: "event_send",
      resourceType: "event_notification",
      before: null,
      after: { kind: "confirmation", recipient: "ana@example.com", result: "sent" },
    });

    expect(summary.changes).toEqual([
      { label: "Tipo", to: "confirmación" },
      { label: "Destinatario", to: "ana@example.com" },
      { label: "Resultado", to: "Enviado" },
    ]);
    const rendered = JSON.stringify(summary.changes);
    expect(rendered).not.toContain("kind");
    expect(rendered).not.toContain("recipient");
    expect(rendered).not.toContain("result");
  });

  it("summarizes legacy entries that only stored the full payload", () => {
    const summary = summarizeAuditLog({
      action: "event_change",
      resourceType: "event",
      before: null,
      after: {
        name: "Shades Spaces GDL",
        capacity: 100,
        agenda: [],
        registrationFormConfig: { version: 1, fields: { phone: { visible: true, required: true } } },
      },
    });

    expect(summary.headline).toBe("Editó el evento");
    expect(summary.changes).toContainEqual({ label: "Nombre", to: "Shades Spaces GDL" });
    expect(summary.changes).toContainEqual({ label: "Capacidad", to: "100" });
    expect(summary.changes.some((change) => change.label.includes("version"))).toBe(false);
  });

  it("never returns raw JSON in the readable summary", () => {
    const summary = summarizeAuditLog({
      action: "event_change",
      resourceType: "event",
      before: { emailContent: { confirmationIntro: "Hola", version: 1 } },
      after: { emailContent: { confirmationIntro: "Bienvenido", version: 1 } },
    });

    const rendered = JSON.stringify(summary);
    expect(rendered).not.toContain('{\\"');
    expect(rendered).not.toContain("version");
  });

  it("describes team assignments and removals", () => {
    expect(summarizeAuditLog({
      action: "create",
      resourceType: "event_editor",
      before: null,
      after: { userId: "user-1" },
    }).headline).toBe("Asignó a un editor");

    expect(summarizeAuditLog({
      action: "create",
      resourceType: "event_editor",
      before: { userId: "user-1" },
      after: null,
    }).headline).toBe("Retiró a un editor");
  });

  it("describes status and webhook changes", () => {
    expect(summarizeAuditLog({
      action: "event_change",
      resourceType: "event",
      before: null,
      after: { status: "published" },
    }).headline).toBe("Cambió el estado a Publicado");

    expect(summarizeAuditLog({
      action: "event_change",
      resourceType: "event_webhook",
      before: null,
      after: { secretRegenerated: true },
    }).headline).toBe("Regeneró el secreto del webhook");
  });
});
