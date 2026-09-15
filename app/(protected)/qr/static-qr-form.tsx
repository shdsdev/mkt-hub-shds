"use client";

import { useActionState, useEffect, useState } from "react";
import { createStaticQrCodeAction, type CreateStaticQrFormState } from "./actions";
import { useQrPreview } from "./use-qr-preview";
import { QrDetailFields, type QrDetailFieldsState } from "./qr-detail-fields";
import { QrDesignFields, type QrDesignFieldsState } from "./qr-design-fields";
import { QrWizardShell } from "./qr-wizard-shell";
import { BinaryLoader } from "@/components/binary-loader";
import { Checkbox } from "@/components/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";
import type { QrDesignTemplateRow } from "@/modules/qr";

const initialState: CreateStaticQrFormState = {};

export type StaticQrKind = "text" | "vcard" | "email" | "sms" | "wifi";

const KIND_TITLE: Record<StaticQrKind, string> = {
  text: "Texto fijo",
  vcard: "vCard",
  email: "Correo electrónico",
  sms: "SMS",
  wifi: "WiFi",
};

const KIND_SUBTITLE: Record<StaticQrKind, string> = {
  text: "Codifica cualquier texto o URL fijo — permanente, no rastreable.",
  vcard: "Comparte datos de contacto al escanear.",
  email: "Abre un correo nuevo con el destinatario ya cargado.",
  sms: "Abre un SMS nuevo con el destinatario ya cargado.",
  wifi: "Conecta a una red WiFi al escanear.",
};

type Fields = {
  content: string;
  fullName: string;
  phone: string;
  email: string;
  company: string;
  website: string;
  address: string;
  subject: string;
  body: string;
  number: string;
  message: string;
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
};

// Mirrors each kind's required fields in the "Datos" step — kept in sync with the server's
// discriminated schema in actions.ts (createStaticSchema) so "Continuar" can't be clicked past
// data the server would reject anyway.
function isDataStepValid(kind: StaticQrKind, fields: Fields): boolean {
  switch (kind) {
    case "text":
      return fields.content.trim().length > 0;
    case "vcard":
      return Boolean(fields.fullName.trim() && fields.phone.trim() && fields.email.trim());
    case "email":
      return Boolean(fields.address.trim());
    case "sms":
      return Boolean(fields.number.trim());
    case "wifi":
      return Boolean(fields.ssid.trim());
  }
}

const EMPTY_FIELDS: Fields = {
  content: "",
  fullName: "",
  phone: "",
  email: "",
  company: "",
  website: "",
  address: "",
  subject: "",
  body: "",
  number: "",
  message: "",
  ssid: "",
  password: "",
  security: "WPA",
  hidden: false,
};

type Step = "detail" | "data" | "design";

export function StaticQrForm({
  kind,
  organizationId,
  folders,
  campaigns,
  templates,
  defaultLogoUrl,
  onBack,
  onCreated,
}: {
  kind: StaticQrKind;
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
  onBack: () => void;
  onCreated: (qrCodeId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createStaticQrCodeAction, initialState);
  const [step, setStep] = useState<Step>("detail");
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [detail, setDetail] = useState<QrDetailFieldsState>({ name: "", grouping: {} });
  const [design, setDesign] = useState<QrDesignFieldsState>({
    backgroundColor: "#1c1213",
    foregroundColor: "#f7edee",
    errorCorrectionLevel: "M",
    logoUrl: defaultLogoUrl,
    dotsType: "square",
    cornersSquareType: "square",
    cornersDotType: "square",
  });

  function setField<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // Only "text" has a client-computable payload identical to what the server will store — the
  // other four kinds build their canonical string server-side (buildStaticPayload lives in the
  // same module as this project's DB/sharp/jsdom code, so importing it here would drag server-only
  // deps into the client bundle); those kinds preview only after creation, in the success panel.
  const previewUrl = useQrPreview({
    payload: kind === "text" ? fields.content || undefined : undefined,
    backgroundColor: design.backgroundColor,
    foregroundColor: design.foregroundColor,
    errorCorrectionLevel: design.errorCorrectionLevel,
    logoUrl: design.logoUrl,
    dotsType: design.dotsType,
    cornersSquareType: design.cornersSquareType,
    cornersDotType: design.cornersDotType,
  });

  useEffect(() => {
    if (state.qrCodeId) onCreated(state.qrCodeId);
  }, [state.qrCodeId, onCreated]);

  const preview = previewUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={previewUrl} alt="Vista previa del QR" className="h-48 w-48" />
  ) : kind === "text" ? (
    <p className="text-sm text-muted-foreground">Completa el contenido para previsualizar</p>
  ) : (
    <p className="text-sm text-muted-foreground">La vista previa aparece después de crear el QR</p>
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />

      {/* All three steps stay mounted (hidden, not unmounted) so their inputs remain part of the
          form's DOM and land in FormData no matter which step is visible when "Crear código QR"
          is finally clicked — a `{step === "x" && (...)}` conditional would unmount the other
          steps' fields and silently drop them from the submission. */}
      <div hidden={step !== "detail"}>
        <QrWizardShell
          step={2}
          totalSteps={4}
          title={KIND_TITLE[kind]}
          subtitle={KIND_SUBTITLE[kind]}
          onBack={onBack}
          preview={preview}
        >
          <QrDetailFields
            organizationId={organizationId}
            folders={folders}
            campaigns={campaigns}
            state={detail}
            onChange={(next) => setDetail((prev) => ({ ...prev, ...next }))}
          />
          <button
            type="button"
            disabled={!detail.name.trim()}
            onClick={() => setStep("data")}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Continuar
          </button>
        </QrWizardShell>
      </div>

      <div hidden={step !== "data"}>
        <QrWizardShell
          step={3}
          totalSteps={4}
          title="Datos"
          subtitle="El contenido que se codificará en el QR."
          onBack={() => setStep("detail")}
          preview={preview}
        >
          {kind === "text" && (
            <div className="space-y-1">
              <label htmlFor="content" className="text-sm text-muted-foreground">
                Contenido — fijo, no rastreable, no editable después de crearlo
              </label>
              <input
                id="content"
                name="content"
                required
                value={fields.content}
                onChange={(event) => setField("content", event.target.value)}
                placeholder="https://ejemplo.com o cualquier texto"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          {kind === "vcard" && (
            <>
              <TextField label="Nombre completo" name="fullName" required value={fields.fullName} onChange={(v) => setField("fullName", v)} />
              <TextField label="Teléfono" name="phone" required value={fields.phone} onChange={(v) => setField("phone", v)} />
              <TextField label="Email" name="email" type="email" required value={fields.email} onChange={(v) => setField("email", v)} />
              <TextField label="Empresa (opcional)" name="company" value={fields.company} onChange={(v) => setField("company", v)} />
              <TextField label="Sitio web (opcional)" name="website" type="url" value={fields.website} onChange={(v) => setField("website", v)} />
            </>
          )}

          {kind === "email" && (
            <>
              <TextField label="Dirección" name="address" type="email" required value={fields.address} onChange={(v) => setField("address", v)} />
              <TextField label="Asunto (opcional)" name="subject" value={fields.subject} onChange={(v) => setField("subject", v)} />
              <TextField label="Cuerpo (opcional)" name="body" value={fields.body} onChange={(v) => setField("body", v)} />
            </>
          )}

          {kind === "sms" && (
            <>
              <TextField label="Número" name="number" required value={fields.number} onChange={(v) => setField("number", v)} />
              <TextField label="Mensaje (opcional)" name="message" value={fields.message} onChange={(v) => setField("message", v)} />
            </>
          )}

          {kind === "wifi" && (
            <>
              <TextField label="SSID" name="ssid" required value={fields.ssid} onChange={(v) => setField("ssid", v)} />
              <TextField label="Contraseña" name="password" value={fields.password} onChange={(v) => setField("password", v)} />
              <div className="space-y-1">
                <label htmlFor="security" className="text-sm text-muted-foreground">
                  Seguridad
                </label>
                <Select
                  name="security"
                  value={fields.security}
                  onValueChange={(value) => value && setField("security", value as Fields["security"])}
                >
                  <SelectTrigger id="security" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="WPA">WPA</SelectItem>
                      <SelectItem value="WEP">WEP</SelectItem>
                      <SelectItem value="nopass">Ninguna</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Checkbox
                name="hidden"
                checked={fields.hidden}
                onChange={(value) => setField("hidden", value)}
                label="Red oculta"
              />
            </>
          )}

          <button
            type="button"
            disabled={!isDataStepValid(kind, fields)}
            onClick={() => setStep("design")}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Continuar
          </button>
        </QrWizardShell>
      </div>

      <div hidden={step !== "design"}>
        <QrWizardShell
          step={4}
          totalSteps={4}
          title="Diseño"
          subtitle="Colores, forma y logo del código QR."
          onBack={() => setStep("data")}
          preview={preview}
        >
          <QrDesignFields
            organizationId={organizationId}
            templates={templates}
            state={design}
            onChange={(next) => setDesign((prev) => ({ ...prev, ...next }))}
            active={step === "design"}
          />

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? <BinaryLoader /> : "Crear código QR"}
          </button>
        </QrWizardShell>
      </div>
    </form>
  );
}

function TextField({
  label,
  name,
  type = "text",
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm text-muted-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
