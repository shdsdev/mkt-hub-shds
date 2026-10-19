"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RegistrationFieldOption = { value: string; label: string };
type RegistrationFieldBase = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  enabled: boolean;
  position: number;
};
export type RegistrationFieldDefinition =
  | (RegistrationFieldBase & { type: "short_text" | "long_text" | "email" | "phone" | "date" })
  | (RegistrationFieldBase & { type: "number"; min?: number; max?: number })
  | (RegistrationFieldBase & { type: "checkbox"; link?: { url: string; text: string } })
  | (RegistrationFieldBase & { type: "select" | "select_multiple"; options: RegistrationFieldOption[] });

type RegistrationFieldValue = string | number | boolean | string[] | undefined;

export function RegistrationFieldRenderer({
  field,
  name = field.id,
  defaultValue,
  disabled = false,
  error,
  onChange,
}: {
  field: RegistrationFieldDefinition;
  name?: string;
  defaultValue?: RegistrationFieldValue;
  disabled?: boolean;
  error?: string;
  onChange?: (value: RegistrationFieldValue) => void;
}) {
  if (!field.enabled) return null;

  const descriptionId = `${name}-description`;
  const errorId = `${name}-error`;
  const describedBy = [field.description ? descriptionId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  const label = (
    <>
      <span>{field.label}</span>
      {field.required ? <span aria-hidden="true" className="ml-1 text-destructive">*</span> : null}
    </>
  );

  function renderControl(): ReactNode {
    switch (field.type) {
      case "long_text":
        return (
          <textarea
            name={name}
            defaultValue={typeof defaultValue === "string" ? defaultValue : undefined}
            required={field.required}
            disabled={disabled}
            aria-required={field.required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
            onChange={(event) => onChange?.(event.target.value)}
          />
        );
      case "number":
        return (
          <Input
            name={name}
            type="number"
            min={field.min}
            max={field.max}
            defaultValue={typeof defaultValue === "number" ? defaultValue : undefined}
            required={field.required}
            disabled={disabled}
            aria-required={field.required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange?.(event.target.value)}
          />
        );
      case "email":
        return <Input name={name} type="email" defaultValue={typeof defaultValue === "string" ? defaultValue : undefined} required={field.required} disabled={disabled} aria-required={field.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={(event) => onChange?.(event.target.value)} />;
      case "phone":
        return <Input name={name} type="tel" defaultValue={typeof defaultValue === "string" ? defaultValue : undefined} required={field.required} disabled={disabled} aria-required={field.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={(event) => onChange?.(event.target.value)} />;
      case "date":
        return <Input name={name} type="date" defaultValue={typeof defaultValue === "string" ? defaultValue : undefined} required={field.required} disabled={disabled} aria-required={field.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={(event) => onChange?.(event.target.value)} />;
      case "select":
        return (
          <Select name={name} defaultValue={typeof defaultValue === "string" ? defaultValue : undefined} disabled={disabled}>
            <SelectTrigger aria-label={field.label} aria-required={field.required} aria-invalid={Boolean(error)}>
              <SelectValue placeholder="Seleccioná una opción" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case "select_multiple":
        return (
          <div className="flex flex-col gap-2" role="group" aria-label={field.label} aria-describedby={describedBy}>
            {field.options.map((option) => (
              <Checkbox
                key={option.value}
                name={name}
                value={option.value}
                {...(Array.isArray(defaultValue) ? { checked: defaultValue.includes(option.value) } : {})}
                disabled={disabled}
                onChange={(checked) => onChange?.(checked ? option.value : "")}
                label={option.label}
              />
            ))}
          </div>
        );
      case "checkbox":
        return (
          <Checkbox
            name={name}
            {...(typeof defaultValue === "boolean" ? { checked: defaultValue } : {})}
            required={field.required}
            disabled={disabled}
            onChange={(checked) => onChange?.(checked)}
            label={
              <>
                {label}
                {field.link ? (
                  <a className="ml-1 underline underline-offset-2" href={field.link.url} onClick={(event) => event.stopPropagation()}>
                    {field.link.text}
                  </a>
                ) : null}
              </>
            }
          />
        );
      case "short_text":
        return <Input name={name} type="text" defaultValue={typeof defaultValue === "string" ? defaultValue : undefined} required={field.required} disabled={disabled} aria-required={field.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={(event) => onChange?.(event.target.value)} />;
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {field.type === "checkbox" ? renderControl() : <label htmlFor={name} className="text-sm font-medium">{label}{renderControl()}</label>}
      {field.description ? <p id={descriptionId} className="text-xs text-muted-foreground">{field.description}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
