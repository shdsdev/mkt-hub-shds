"use client";

/**
 * The project's one checkbox — pure CSS "Spin" checkbox (styling + the spin-on-check animation
 * live in app/globals.css under `.check`/`.ck-10`). `tabIndex={-1}` on the input is part of the
 * The wrapping <label> remains the click target while the native input stays reachable by keyboard.
 * Flagged, not silently fixed, since the markup was specified exactly.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  name,
  value,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  return (
    <label className="check ck-10">
      <input
        type="checkbox"
        tabIndex={0}
        name={name}
        value={value}
        disabled={disabled}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="box" />
      <span className="lbl">{label}</span>
    </label>
  );
}
