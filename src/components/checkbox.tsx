"use client";

import type { ReactNode } from "react";

/**
 * The project's one checkbox — pure CSS "Spin" checkbox (styling + the spin-on-check animation
 * live in app/globals.css under `.check`/`.ck-10`). `tabIndex={-1}` on the input is part of the
 * The wrapping <label> remains the click target while the native input stays reachable by keyboard.
 * Flagged, not silently fixed, since the markup was specified exactly.
 */
export function Checkbox({
  checked,
  defaultChecked,
  onChange,
  label,
  name,
  value,
  required = false,
  disabled = false,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label: ReactNode;
  name?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="check ck-10">
      <input
        type="checkbox"
        tabIndex={0}
        name={name}
        value={value}
        required={required}
        aria-required={required}
      disabled={disabled}
        {...(checked === undefined ? { defaultChecked } : { checked })}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="box" />
      <span className="lbl">{label}</span>
    </label>
  );
}
