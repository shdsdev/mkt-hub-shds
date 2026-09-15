"use client";

import { useState } from "react";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

// A hex text field + native color swatch sharing one bordered box — the reference layout the user
// pointed at. `name` stays on the color input only: that's the one guaranteed to always hold a
// valid 6-digit hex (native color inputs can't produce anything else), so it's the value that
// actually gets submitted. The text field is a free-typing mirror that only propagates upward
// once it matches a valid hex — until then the user can type without the parent value flickering
// through invalid intermediate states.
export function ColorField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  function handleTextChange(next: string) {
    setText(next);
    if (HEX_PATTERN.test(next)) onChange(next);
  }

  return (
    <div className="flex-1 space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <input
          type="text"
          value={text}
          onChange={(event) => handleTextChange(event.target.value)}
          spellCheck={false}
          className="w-full bg-transparent font-mono text-sm outline-none"
        />
        <input
          type="color"
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-6 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0"
        />
      </div>
    </div>
  );
}
