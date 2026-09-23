// The package's own types.d.ts only declares the "svg2pdf.js" module, but that resolves (via
// "main") to a minified UMD bundle whose named export Node's ESM loader can't see — we import the
// ES build directly instead (src/modules/qr/service.ts). Re-export its already-correct types here.
declare module "svg2pdf.js/dist/svg2pdf.es.js" {
  export * from "svg2pdf.js";
}
