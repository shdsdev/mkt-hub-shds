"use client";

/**
 * The project's one checkbox — pure CSS "Spin" checkbox (styling + the spin-on-check animation
 * live in app/globals.css under `.check`/`.ck-10`). `tabIndex={-1}` on the input is part of the
 * exact given markup: the wrapping <label> is the click target (native label-click still toggles
 * it), but it means the control is NOT reachable via Tab — keyboard users can't focus it directly.
 * Flagged, not silently fixed, since the markup was specified exactly.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  name?: string;
}) {
  return (
    <label className="check ck-10">
      <input
        type="checkbox"
        tabIndex={-1}
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="box" />
      <span className="lbl">{label}</span>
    </label>
  );
}
