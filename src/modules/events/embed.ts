export function getEventEmbedUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/events/embed/${encodeURIComponent(slug)}`;
}

export function getEventEmbedSnippet(origin: string, slug: string): string {
  const embedUrl = getEventEmbedUrl(origin, slug);
  return `<div data-event-registration-embed><iframe src="${embedUrl}" style="width:100%;min-height:760px;border:0;overflow:hidden" loading="lazy" title="Formulario de registro"></iframe></div><script>(function(){var frame=document.currentScript.previousElementSibling.querySelector("iframe");var origin=new URL(frame.src).origin;window.addEventListener("message",function(event){if(event.origin!==origin||event.source!==frame.contentWindow)return;var data=event.data;if(!data||data.type!=="event-registration:resize"||!Number.isFinite(data.height)||data.height<320||data.height>10000)return;frame.style.height=Math.ceil(data.height)+"px";frame.style.minHeight="0";});})();</script>`;
}
