// Generic answer reading for providers built on native inputs and ARIA widgets.

const TEXT_INPUTS = [
  'input:not([type])',
  ...['text', 'email', 'number', 'tel', 'url', 'date', 'time', 'datetime-local', 'month', 'week'].map(
    (t) => `input[type="${t}"]`,
  ),
  'textarea',
].join(', ');

const ARIA_CHOSEN =
  '[role="radio"][aria-checked="true"], [role="checkbox"][aria-checked="true"], ' +
  '[role="switch"][aria-checked="true"], [role="option"][aria-selected="true"], ' +
  '[role="menuitemradio"][aria-checked="true"]';

export function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Strip numbering and required markers from a question label: "3. Name *" → "Name". */
export function cleanQuestion(text: string | null | undefined): string {
  return clean(text)
    .replace(/^\d+\s*[.)]\s*/, '')
    .replace(/\s*(\*|\(required\))\s*$/i, '')
    .trim();
}

function labelText(el: HTMLInputElement): string {
  const label =
    el.labels?.[0] ?? (el.id ? el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
  return clean(label?.textContent) || clean(el.getAttribute('aria-label')) || el.value;
}

function ariaChoiceText(el: Element): string {
  const value = el.getAttribute('value') ?? el.getAttribute('data-value');
  return clean(el.getAttribute('aria-label')) || clean(el.textContent) || (value ?? '');
}

/** Read every answered control inside `scope` and join the values. */
export function readControls(scope: Element, separator = ', '): string {
  const values: string[] = [];

  for (const el of scope.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')) {
    if (el.checked) values.push(labelText(el));
  }
  for (const el of scope.querySelectorAll(ARIA_CHOSEN)) {
    if (el instanceof HTMLInputElement) continue; // counted above
    values.push(ariaChoiceText(el));
  }
  for (const select of scope.querySelectorAll('select')) {
    for (const option of select.selectedOptions) if (option.value) values.push(clean(option.textContent));
  }
  for (const el of scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT_INPUTS)) {
    if (el.closest('[role="option"], [role="listbox"]')) continue; // search box inside a dropdown
    const v = el.value.trim();
    if (v) values.push(v);
  }
  for (const el of scope.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    for (const file of el.files ?? []) values.push(file.name);
  }

  return [...new Set(values.filter(Boolean))].join(separator);
}
