export function getEventEmbedUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/events/embed/${encodeURIComponent(slug)}`;
}

export function getEventEmbedSnippet(origin: string, slug: string): string {
  return `<iframe src="${getEventEmbedUrl(origin, slug)}" style="width:100%;min-height:760px;border:0" loading="lazy" title="Formulario de registro"></iframe>`;
}
