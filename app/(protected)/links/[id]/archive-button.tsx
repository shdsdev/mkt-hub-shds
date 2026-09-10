import { archiveLinkAction, archiveShortLinkAction } from "../actions";

// Archive only — no hard-delete action exists anywhere in this app (I-7). Archived resources
// keep resolving (Phase 6 design) — this just moves them out of the active-management view.
export function ArchiveLinkButton({ linkId }: { linkId: string }) {
  return (
    <form action={archiveLinkAction}>
      <input type="hidden" name="linkId" value={linkId} />
      <button type="submit" className="text-sm text-accent hover:underline">
        Archivar
      </button>
    </form>
  );
}

export function ArchiveShortLinkButton({
  shortLinkId,
  linkId,
}: {
  shortLinkId: string;
  linkId: string;
}) {
  return (
    <form action={archiveShortLinkAction}>
      <input type="hidden" name="shortLinkId" value={shortLinkId} />
      <input type="hidden" name="linkId" value={linkId} />
      <button type="submit" className="text-xs text-accent hover:underline">
        Archivar
      </button>
    </form>
  );
}
