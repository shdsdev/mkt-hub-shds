/**
 * "Binar" loading indicator — pure CSS, no animation library. Markup and
 * class name are load-bearing: the animation lives in app/globals.css under
 * `.ld-binary`. Color comes from `--ink` (defaults to currentColor), so wrap
 * this in an element with the `text-*` color you want, or set `--ink`.
 */
export function BinaryLoader() {
  return <span className="ld-binary" />;
}
