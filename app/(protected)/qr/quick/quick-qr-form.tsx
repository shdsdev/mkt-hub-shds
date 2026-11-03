"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clipboard, Download, FileText, Globe, Mail, MessageCircle, Phone, UserRound, Wifi } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildQuickPayload, quickContentSchema, type QuickContent } from "@/lib/quick-qr-content";

type QuickQrKind = QuickContent["kind"];
type ShapeType = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type CornerType = ShapeType | "dot";
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type DownloadExtension = "png" | "svg" | "jpeg";
type QrInstance = { getRawData: (extension: DownloadExtension) => Promise<unknown> };

type QuickFields = {
  value: string;
  number: string;
  message: string;
  address: string;
  subject: string;
  body: string;
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
  fullName: string;
  company: string;
  phone: string;
  email: string;
  website: string;
};

type Design = {
  foregroundColor: string;
  backgroundColor: string;
  size: number;
  margin: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dotsType: ShapeType;
  cornersSquareType: CornerType;
  cornersDotType: CornerType;
};

const INITIAL_FIELDS: QuickFields = {
  value: "",
  number: "",
  message: "",
  address: "",
  subject: "",
  body: "",
  ssid: "",
  password: "",
  security: "WPA",
  hidden: false,
  fullName: "",
  company: "",
  phone: "",
  email: "",
  website: "",
};

const INITIAL_DESIGN: Design = {
  foregroundColor: "#000000",
  backgroundColor: "#ffffff",
  size: 320,
  margin: 16,
  errorCorrectionLevel: "M",
  dotsType: "square",
  cornersSquareType: "square",
  cornersDotType: "square",
};

const TYPE_OPTIONS: { value: QuickQrKind; label: string; icon: typeof Globe }[] = [
  { value: "url", label: "URL", icon: Globe },
  { value: "text", label: "Texto libre", icon: FileText },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "wifi", label: "WiFi", icon: Wifi },
  { value: "phone", label: "Teléfono", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "vcard", label: "Contacto / vCard", icon: UserRound },
];

const SHAPE_OPTIONS: { value: ShapeType; label: string }[] = [
  { value: "square", label: "Cuadrado" },
  { value: "rounded", label: "Redondeado" },
  { value: "dots", label: "Puntos" },
  { value: "classy", label: "Classy" },
  { value: "classy-rounded", label: "Classy redondeado" },
  { value: "extra-rounded", label: "Extra redondeado" },
];

const CORNER_OPTIONS: { value: CornerType; label: string }[] = [
  ...SHAPE_OPTIONS,
  { value: "dot", label: "Punto" },
];

const ERROR_CORRECTION_OPTIONS: { value: ErrorCorrectionLevel; label: string }[] = [
  { value: "L", label: "Low · 7%" },
  { value: "M", label: "Medium · 15% (recommended)" },
  { value: "Q", label: "Quartile · 25%" },
  { value: "H", label: "High · 30%" },
];

type ShapeDropdownField = "dotsType" | "cornersSquareType" | "cornersDotType";

function getFieldsForKind(kind: QuickQrKind, fields: QuickFields): QuickContent {
  switch (kind) {
    case "url":
    case "text":
      return { kind, value: fields.value };
    case "whatsapp":
      return { kind, number: fields.number, message: fields.message };
    case "phone":
      return { kind, number: fields.number };
    case "email":
      return { kind, address: fields.address, subject: fields.subject, body: fields.body };
    case "wifi":
      return { kind, ssid: fields.ssid, password: fields.password, security: fields.security, hidden: fields.hidden };
    case "vcard":
      return {
        kind,
        fullName: fields.fullName,
        company: fields.company,
        phone: fields.phone,
        email: fields.email,
        website: fields.website,
        address: fields.address,
      };
  }
}

export function QuickQrForm() {
  const [kind, setKind] = useState<QuickQrKind>("url");
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [design, setDesign] = useState(INITIAL_DESIGN);
  const [generatedPayload, setGeneratedPayload] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QrInstance | undefined>(undefined);

  function clearGenerated() {
    setGeneratedPayload(undefined);
    setError(undefined);
    setNotice(undefined);
  }

  function updateField<K extends keyof QuickFields>(field: K, value: QuickFields[K]) {
    setFields((current) => ({ ...current, [field]: value }));
    clearGenerated();
  }

  function updateDesign<K extends keyof Design>(field: K, value: Design[K]) {
    setDesign((current) => ({ ...current, [field]: value }));
    clearGenerated();
  }

  function selectKind(value: QuickQrKind) {
    setKind(value);
    setFields(INITIAL_FIELDS);
    clearGenerated();
  }

  function generate() {
    const result = quickContentSchema.safeParse(getFieldsForKind(kind, fields));
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Revisa los datos del QR.");
      setNotice(undefined);
      return;
    }
    setGeneratedPayload(buildQuickPayload(result.data));
    setError(undefined);
    setNotice(undefined);
  }

  useEffect(() => {
    let cancelled = false;
    const container = qrContainerRef.current;
    container?.replaceChildren();
    qrRef.current = undefined;

    if (!generatedPayload || !container) return;

    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled || !container) return;
      const qr = new QRCodeStyling({
        width: design.size,
        height: design.size,
        margin: design.margin,
        type: "svg",
        data: generatedPayload,
        qrOptions: { errorCorrectionLevel: design.errorCorrectionLevel },
        dotsOptions: { type: design.dotsType, color: design.foregroundColor },
        cornersSquareOptions: { type: design.cornersSquareType, color: design.foregroundColor },
        cornersDotOptions: { type: design.cornersDotType, color: design.foregroundColor },
        backgroundOptions: { color: design.backgroundColor },
      });
      qr.append(container);
      qrRef.current = qr;
    });

    return () => {
      cancelled = true;
      container?.replaceChildren();
      qrRef.current = undefined;
    };
  }, [design, generatedPayload]);

  async function download(extension: DownloadExtension) {
    if (!qrRef.current) return;
    try {
      const blob = await qrRef.current.getRawData(extension);
      if (!(blob instanceof Blob)) throw new Error("No se pudo preparar la descarga.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quick-qr.${extension === "jpeg" ? "jpg" : extension}`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(`Descarga ${extension === "jpeg" ? "JPG" : extension.toUpperCase()} iniciada.`);
      setError(undefined);
    } catch {
      setError("No se pudo preparar la descarga. Intenta generar el QR nuevamente.");
    }
  }

  async function copyImage() {
    if (!qrRef.current || typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      setError("Tu navegador no permite copiar imágenes; usa una de las descargas disponibles.");
      return;
    }
    try {
      const blob = await qrRef.current.getRawData("png");
      if (!(blob instanceof Blob)) throw new Error("No se pudo preparar la imagen.");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setNotice("Imagen copiada al portapapeles.");
      setError(undefined);
    } catch {
      setError("No se pudo copiar la imagen; usa una de las descargas disponibles.");
    }
  }

  const selectedType = TYPE_OPTIONS.find((option) => option.value === kind);
  const TypeIcon = selectedType?.icon ?? Globe;
  const sizeProgress = ((design.size - 160) / (800 - 160)) * 100;
  const marginProgress = (design.margin / 48) * 100;

  return (
    <div className="quick-qr-surface grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-accent/15 p-2 text-accent"><TypeIcon className="size-5" aria-hidden="true" /></span>
          <div>
            <h2 className="font-heading text-lg font-semibold">Contenido</h2>
            <p className="text-sm text-muted-foreground">Elige qué quieres codificar.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectKind(value)}
              aria-pressed={kind === value}
              style={kind === value ? { borderColor: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" } : undefined}
              className={`flex min-h-20 flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === value ? "text-foreground" : "border-border hover:border-primary/50"}`}
            >
              <Icon className="size-4 text-accent" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(kind === "url" || kind === "text") && (
            <Field label={kind === "url" ? "URL válida" : "Texto"} value={fields.value} onChange={(value) => updateField("value", value)} placeholder={kind === "url" ? "https://ejemplo.com" : "Escribe el texto que quieres compartir"} wide />
          )}
          {(kind === "whatsapp" || kind === "phone") && (
            <>
              <Field label="Teléfono internacional" value={fields.number} onChange={(value) => updateField("number", value)} placeholder="+52 33 1234 5678" />
              {kind === "whatsapp" ? <Field label="Mensaje (opcional)" value={fields.message} onChange={(value) => updateField("message", value)} placeholder="Hola" /> : null}
            </>
          )}
          {kind === "email" && (
            <>
              <Field label="Email" value={fields.address} onChange={(value) => updateField("address", value)} placeholder="correo@ejemplo.com" />
              <Field label="Asunto (opcional)" value={fields.subject} onChange={(value) => updateField("subject", value)} />
              <Field label="Mensaje (opcional)" value={fields.body} onChange={(value) => updateField("body", value)} wide />
            </>
          )}
          {kind === "wifi" && (
            <>
              <Field label="Nombre de la red (SSID)" value={fields.ssid} onChange={(value) => updateField("ssid", value)} />
              <Field label="Contraseña" value={fields.password} onChange={(value) => updateField("password", value)} type="password" />
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Seguridad</span>
                <Select value={fields.security} onValueChange={(value) => updateField("security", value as QuickFields["security"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WPA">WPA / WPA2 / WPA3</SelectItem>
                    <SelectItem value="WEP">WEP</SelectItem>
                    <SelectItem value="nopass">Red abierta</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" checked={fields.hidden} onChange={(event) => updateField("hidden", event.target.checked)} />
                Red oculta
              </label>
            </>
          )}
          {kind === "vcard" && (
            <>
              <Field label="Nombre completo" value={fields.fullName} onChange={(value) => updateField("fullName", value)} />
              <Field label="Empresa (opcional)" value={fields.company} onChange={(value) => updateField("company", value)} />
              <Field label="Teléfono internacional" value={fields.phone} onChange={(value) => updateField("phone", value)} placeholder="+52 33 1234 5678" />
              <Field label="Email" value={fields.email} onChange={(value) => updateField("email", value)} placeholder="correo@ejemplo.com" />
              <Field label="Sitio web (opcional)" value={fields.website} onChange={(value) => updateField("website", value)} placeholder="https://ejemplo.com" />
              <Field label="Dirección (opcional)" value={fields.address} onChange={(value) => updateField("address", value)} />
            </>
          )}
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <h2 className="font-heading text-lg font-semibold">Diseño</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ColorField label="Color del QR" value={design.foregroundColor} onChange={(value) => updateDesign("foregroundColor", value)} />
            <ColorField label="Color de fondo" value={design.backgroundColor} onChange={(value) => updateDesign("backgroundColor", value)} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Tamaño: {design.size}px</span>
              <input className="quick-qr-range" style={{ "--quick-progress": `${sizeProgress}%` } as React.CSSProperties} type="range" min="160" max="800" step="10" value={design.size} onChange={(event) => updateDesign("size", Number(event.target.value))} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Margen: {design.margin}px</span>
              <input className="quick-qr-range" style={{ "--quick-progress": `${marginProgress}%` } as React.CSSProperties} type="range" min="0" max="48" step="2" value={design.margin} onChange={(event) => updateDesign("margin", Number(event.target.value))} />
            </label>
            <div className="grid gap-3 sm:col-span-2">
              <ShapeAccordion
                label="Forma del cuerpo"
                field="dotsType"
                value={design.dotsType}
                options={SHAPE_OPTIONS}
                onChange={(value) => updateDesign("dotsType", value as ShapeType)}
              />
              <ShapeAccordion
                label="Forma del marco del ojo"
                field="cornersSquareType"
                value={design.cornersSquareType}
                options={CORNER_OPTIONS}
                onChange={(value) => updateDesign("cornersSquareType", value as CornerType)}
              />
              <ShapeAccordion
                label="Forma del ojo"
                field="cornersDotType"
                value={design.cornersDotType}
                options={CORNER_OPTIONS}
                onChange={(value) => updateDesign("cornersDotType", value as CornerType)}
              />
            </div>
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Corrección de errores</span>
              <Select value={design.errorCorrectionLevel} onValueChange={(value) => updateDesign("errorCorrectionLevel", value as ErrorCorrectionLevel)}>
                <SelectTrigger className="sm:max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ERROR_CORRECTION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Un nivel mayor tolera más daño, pero puede hacer el QR más denso.</span>
            </label>
          </div>
        </div>

        {error ? <p role="alert" className="mt-5 text-sm text-destructive">{error}</p> : null}
        {notice ? <p role="status" className="mt-5 text-sm text-accent">{notice}</p> : null}
        <button type="button" onClick={generate} className="mt-6 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Generar QR
        </button>
      </section>

      <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">Vista previa</h2>
          <p className="text-sm text-muted-foreground">El resultado solo existe en esta sesión.</p>
        </div>
        <div className="mt-5 flex min-h-56 min-w-0 flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-3 sm:min-h-80 sm:p-5">
          {generatedPayload ? <div ref={qrContainerRef} className="quick-qr-preview min-w-0 max-w-full" style={{ width: design.size }} aria-label="Código QR generado" /> : <p className="max-w-xs text-center text-sm text-muted-foreground">Completa los datos y presiona “Generar QR”.</p>}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActionButton label="PNG" onClick={() => void download("png")} disabled={!generatedPayload} />
          <ActionButton label="SVG" onClick={() => void download("svg")} disabled={!generatedPayload} />
          <ActionButton label="JPG" onClick={() => void download("jpeg")} disabled={!generatedPayload} />
          <button type="button" onClick={() => void copyImage()} disabled={!generatedPayload} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50">
            <Clipboard className="size-3.5" aria-hidden="true" /> Copiar
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; wide?: boolean }) {
  return (
    <label className={`grid min-w-0 gap-1.5 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/20" />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="font-mono text-xs uppercase text-muted-foreground">{value}</span>
      </span>
    </label>
  );
}

function ShapeAccordion({
  label,
  field,
  value,
  options,
  onChange,
}: {
  label: string;
  field: ShapeDropdownField;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`quick-qr-${field}-options`}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Seleccionado: {selected.label}</span>
        </span>
        <ChevronDown className={`size-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div id={`quick-qr-${field}-options`} role="group" aria-label={`Opciones de ${label.toLowerCase()}`} className="grid grid-cols-2 gap-3 border-t border-border/70 p-4 sm:grid-cols-4 lg:grid-cols-6">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={`group flex min-h-32 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === option.value ? "border-2 border-accent bg-accent/10" : "border-border bg-background hover:border-accent/60 hover:bg-accent/5"}`}
            >
              <ShapeThumbnail field={field} option={option.value} />
              <span className={`line-clamp-2 text-[11px] leading-tight ${value === option.value ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ShapeThumbnail({ field, option }: { field: ShapeDropdownField; option: string }) {
  if (field === "dotsType") return <BodyShapeThumbnail option={option as ShapeType} />;
  const color = "#111111";
  return (
    <span className="quick-qr-thumbnail flex items-center justify-center overflow-hidden rounded-xl bg-white" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="42" height="42" rx="10" fill="#ffffff" />
        {field === "cornersSquareType" ? <FrameSample type={option as CornerType} color={color} /> : null}
        {field === "cornersDotType" ? <EyeSample type={option as CornerType} color={color} /> : null}
      </svg>
    </span>
  );
}

function BodyShapeThumbnail({ option }: { option: ShapeType }) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled || !container) return;
      const qr = new QRCodeStyling({
        width: 128,
        height: 128,
        margin: 4,
        type: "svg",
        data: "https://example.com",
        qrOptions: { errorCorrectionLevel: "M" },
        dotsOptions: { type: option, color: "#111111" },
        cornersSquareOptions: { type: "square", color: "#111111" },
        cornersDotOptions: { type: "square", color: "#111111" },
        backgroundOptions: { color: "#ffffff" },
      });
      container.replaceChildren();
      qr.append(container);
    });

    return () => {
      cancelled = true;
      container?.replaceChildren();
    };
  }, [option]);

  return <span ref={containerRef} className="quick-qr-thumbnail flex items-center justify-center overflow-hidden rounded-xl bg-white" aria-hidden="true" />;
}

function FrameSample({ type, color }: { type: CornerType; color: string }) {
  if (type === "dot") return <rect x="7" y="7" width="34" height="34" rx="17" stroke={color} strokeWidth="5" strokeDasharray="1 3" />;
  if (type === "dots") return <rect x="7" y="7" width="34" height="34" stroke={color} strokeWidth="5" strokeDasharray="1 3" />;
  if (type === "classy") return <path d="M11 7H37L41 11V37L37 41H11L7 37V11L11 7Z" stroke={color} strokeWidth="5" />;
  if (type === "classy-rounded") return <path d="M15 7H33C38 7 41 10 41 15V33C41 38 38 41 33 41H15C10 41 7 38 7 33V15C7 10 10 7 15 7Z" stroke={color} strokeWidth="5" />;
  if (type === "extra-rounded") return <rect x="7" y="7" width="34" height="34" rx="13" stroke={color} strokeWidth="5" />;
  return <rect x="7" y="7" width="34" height="34" rx={type === "rounded" ? 9 : 0} stroke={color} strokeWidth="5" />;
}

function EyeSample({ type, color }: { type: CornerType; color: string }) {
  if (type === "dot") return <circle cx="24" cy="24" r="10" fill={color} />;
  if (type === "dots") return <><circle cx="17" cy="17" r="4" fill={color} /><circle cx="31" cy="17" r="4" fill={color} /><circle cx="17" cy="31" r="4" fill={color} /><circle cx="31" cy="31" r="4" fill={color} /></>;
  return <ShapeMark type={type} x={11} y={11} size={26} color={color} />;
}

function ShapeMark({ type, x, y, size, color }: { type: ShapeType; x: number; y: number; size: number; color: string }) {
  if (type === "dots") return <circle cx={x + size / 2} cy={y + size / 2} r={size / 2} fill={color} />;
  if (type === "classy") return <path d={`M${x + 1} ${y}H${x + size - 1}V${y + size - 1}H${x + 2}L${x} ${y + size - 2}V${y + 1}Z`} fill={color} />;
  if (type === "classy-rounded") return <path d={`M${x + 2} ${y}H${x + size - 2}C${x + size - 1} ${y} ${x + size} ${y + 1} ${x + size} ${y + 2}V${y + size - 2}C${x + size} ${y + size - 1} ${x + size - 1} ${y + size} ${x + size - 2} ${y + size}H${x + 2}C${x + 1} ${y + size} ${x} ${y + size - 1} ${x} ${y + size - 2}V${y + 2}C${x} ${y + 1} ${x + 1} ${y} ${x + 2} ${y}Z`} fill={color} />;
  return <rect x={x} y={y} width={size} height={size} rx={type === "rounded" || type === "extra-rounded" ? size * 0.28 : 0} fill={color} />;
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"><Download className="size-3.5" aria-hidden="true" />{label}</button>;
}
