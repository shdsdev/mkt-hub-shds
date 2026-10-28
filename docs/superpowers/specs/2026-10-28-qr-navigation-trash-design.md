# QR Navigation and Trash

## Approved Behavior

- Replace the QR group tabs and group dropdowns with an internal, collapsible desktop sidebar and a modal mobile organizer.
- On mobile, the selected group name is the header trigger, with a chevron and accessible change-group label. Open a content-height bottom sheet capped at 85dvh, with scrolling, safe-area padding, and focus restoration. Do not add a separate organizer row above the header.
- Keep inactive navigation and empty-state text readable, including the enabled trash destination. Use at least 44px navigation targets on mobile.
- Offer all QR codes, expandable folders and campaigns with organization-wide counts, and trash. Include empty groups and ended campaigns.
- Selecting a group clears the other group selection and resets pagination. Search and type/status filters remain scoped to that selection.
- Expose delete in both list and grid layouts, with a confirmation describing the effect on printed codes.
- Soft-delete into trash, preserving the original status and analytics history. Restore from trash without changing that status.
- A deleted dynamic QR returns HTTP 410 with a readable message and no-store caching before tracking or redirecting. Match its exact short link and organization; ordinary short-link clicks remain unchanged.
- Static copies cannot be remotely disabled. Explain that limitation in their deletion confirmation.
- Keep archive distinct: archived QR codes continue resolving.
- Restrict delete/restore to active administrators and marketing managers. Scope all mutations to the current organization.

## Storage and Delivery

Add nullable `qr_codes.deleted_at` using migration `0061_qr_soft_delete.sql`. Normal listing and group counts exclude deleted rows; trash listing includes only deleted rows. No permanent deletion or retention job is included.

## Verification

Behavioral tests cover group selection, scoped search, pagination, sidebar collapse, mobile focus restoration, deletion/restore feedback, authorization, persistence predicates, and redirect isolation. Visual review of the protected screen requires an authenticated browser session.
