export type QrGroupTab = "all" | "folders" | "campaigns";

export function requiresGroupSelection(
  groupTab: QrGroupTab,
  folderId: string | undefined,
  campaignId: string | undefined,
): boolean {
  return (groupTab === "folders" && !folderId) || (groupTab === "campaigns" && !campaignId);
}
