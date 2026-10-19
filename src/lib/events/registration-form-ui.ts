export function toggleClientBrandOption<T extends string>(
  selected: readonly T[],
  option: T,
  enabled: boolean,
): T[] {
  if (!enabled) return selected.filter((value) => value !== option);
  if (option === "none") return [option];
  return [...selected.filter((value) => value !== "none" && value !== option), option];
}

export function getPublicClientBrandOptions(configured: readonly string[]): string[] {
  return ["none", ...configured.filter((value) => value !== "none")];
}
