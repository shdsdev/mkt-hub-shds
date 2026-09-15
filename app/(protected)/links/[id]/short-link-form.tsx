"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Domain } from "@/modules/links";
import { createShortLinkAction, type CreateShortLinkFormState } from "../actions";
import { BinaryLoader } from "@/components/binary-loader";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: CreateShortLinkFormState = {};

export function ShortLinkForm({ linkId, domains }: { linkId: string; domains: Domain[] }) {
  const [state, formAction, pending] = useActionState(createShortLinkAction, initialState);

  if (domains.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Agrega un dominio en la página de{" "}
        <Link href="/links" className="text-accent hover:underline">
          Enlaces
        </Link>{" "}
        antes de crear un enlace corto.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="linkId" value={linkId} />

      <div className="space-y-1">
        <label htmlFor="domainId" className="text-xs text-muted-foreground">
          Dominio
        </label>
        <Select name="domainId" defaultValue={domains[0].id} required>
          <SelectTrigger id="domainId" className="min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {domains.map((domain) => (
                <SelectItem key={domain.id} value={domain.id}>
                  {domain.hostname}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label htmlFor="slug" className="text-xs text-muted-foreground">
          Slug (opcional — se genera automático si está vacío)
        </label>
        <input
          id="slug"
          name="slug"
          placeholder="automático"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? <BinaryLoader /> : "Crear enlace corto"}
      </button>

      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
