export type FormValueSnapshot = Record<string, string[]>;

export function snapshotFormValues(form: HTMLFormElement): FormValueSnapshot {
  const snapshot: FormValueSnapshot = {};
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name) {
      continue;
    }
    if ((element instanceof HTMLInputElement) && (element.type === "checkbox" || element.type === "radio") && !element.checked) {
      continue;
    }
    const value = element instanceof HTMLSelectElement && element.multiple
      ? Array.from(element.selectedOptions).map((option) => option.value)
      : [element.value];
    snapshot[element.name] = [...(snapshot[element.name] ?? []), ...value];
  }
  return snapshot;
}

export function restoreFormValues(form: HTMLFormElement, snapshot: FormValueSnapshot): void {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name) {
      continue;
    }
    const values = snapshot[element.name] ?? [];
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      element.checked = values.includes(element.value);
    } else if (element instanceof HTMLSelectElement && element.multiple) {
      for (const option of Array.from(element.options)) option.selected = values.includes(option.value);
    } else {
      element.value = values[0] ?? "";
    }
  }
}
