"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BinaryLoader } from "@/components/binary-loader";
import { createFolderQuickAction, createCampaignQuickAction } from "./actions";
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";

const NEW_FOLDER = "__new_folder__";
const NEW_CAMPAIGN = "__new_campaign__";

// Controlled only — deliberately no `name` prop. A single Select value space can't cleanly submit
// two separate form fields (folderId/campaignId), so the parent owns that state and renders its
// own hidden inputs from `onChange`'s result, same pattern as this form family's other derived
// hidden inputs (logoUrl, placementImageUrl).
//
// This dropdown is also the only place in the app a folder or campaign can be created — there's
// no dedicated "Carpetas" page — so picking "+ Nueva carpeta"/"+ Nueva campaña" opens an inline
// name field instead of sending the user away. The newly created row is appended to local state
// (folders/campaigns props only refresh on next page load) and selected immediately.
export function GroupSelect({
  folders,
  campaigns,
  value,
  onChange,
  required = false,
}: {
  folders: Folder[];
  campaigns: Campaign[];
  value: { folderId?: string; campaignId?: string };
  onChange: (next: { folderId?: string; campaignId?: string }) => void;
  required?: boolean;
}) {
  const [localFolders, setLocalFolders] = useState(folders);
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);
  const [creating, setCreating] = useState<"folder" | "campaign" | null>(null);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const selected = value.folderId
    ? `folder:${value.folderId}`
    : value.campaignId
      ? `campaign:${value.campaignId}`
      : "none";

  function labelFor(next: string | null) {
    if (!next || next === "none") return "Sin agrupar";
    const [prefix, id] = next.split(":");
    if (prefix === "folder") return localFolders.find((f) => f.id === id)?.name ?? "Sin agrupar";
    return localCampaigns.find((c) => c.id === id)?.name ?? "Sin agrupar";
  }

  function handleValueChange(next: string | null) {
    if (next === NEW_FOLDER) {
      setCreating("folder");
      setNewName("");
      setError(undefined);
      return;
    }
    if (next === NEW_CAMPAIGN) {
      setCreating("campaign");
      setNewName("");
      setError(undefined);
      return;
    }
    if (!next || next === "none") {
      onChange({});
      return;
    }
    const [prefix, id] = next.split(":");
    if (prefix === "folder") onChange({ folderId: id });
    else if (prefix === "campaign") onChange({ campaignId: id });
  }

  async function handleCreate() {
    setPending(true);
    setError(undefined);

    if (creating === "folder") {
      const result = await createFolderQuickAction(newName);
      setPending(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setLocalFolders((prev) => [...prev, result]);
      onChange({ folderId: result.id });
    } else if (creating === "campaign") {
      const result = await createCampaignQuickAction(newName);
      setPending(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setLocalCampaigns((prev) => [...prev, result]);
      onChange({ campaignId: result.id });
    }
    setCreating(null);
    setNewName("");
  }

  if (creating) {
    return (
      <div className="space-y-2 rounded-md border border-input p-3">
        <label className="text-xs text-muted-foreground">
          {creating === "folder" ? "Nombre de la carpeta nueva" : "Nombre de la campaña nueva"}
        </label>
        <input
          autoFocus
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleCreate();
            }
          }}
          placeholder={creating === "folder" ? "Ej. Lanzamiento verano" : "Ej. Aria Dimout"}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? <BinaryLoader /> : "Crear"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setCreating(null)}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <Select value={selected} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue>{labelFor}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {!required && <SelectItem value="none">Sin agrupar</SelectItem>}
        </SelectGroup>
        {localFolders.length > 0 && (
          <SelectGroup>
            {localFolders.map((folder) => (
              <SelectItem key={folder.id} value={`folder:${folder.id}`}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {localCampaigns.length > 0 && (
          <SelectGroup>
            {localCampaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={`campaign:${campaign.id}`}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        <SelectSeparator />
        <SelectGroup>
          <SelectItem value={NEW_FOLDER}>+ Nueva carpeta</SelectItem>
          <SelectItem value={NEW_CAMPAIGN}>+ Nueva campaña</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
