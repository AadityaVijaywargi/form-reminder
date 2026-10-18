import type { Answer, ProviderAdapter } from './types';

// Selectors reflect Google Forms markup as of Oct 2026. Keep every Google-specific
// selector in this file so a markup change is a one-file fix.
const QUESTION = '[role="listitem"]';
const CHOICE = '[role="radio"], [role="checkbox"]';
const TYPED = [
  'input[type="text"]',
  'input[type="email"]',
  'input[type="number"]',
  'input[type="date"]',
  'input[type="time"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input:not([type])',
  'textarea',
].join(', ');
const OTHER_OPTION = '__other_option__';

const FORM_ID = /\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?([\w-]+)/;

export const google: ProviderAdapter = {
  id: 'google',
  name: 'Google Forms',
  matches: ['https://docs.google.com/forms/*'],
  // No submitRequest: /formResponse is POSTed on every "Next" as well as on Submit.

  formId: (url) => url.pathname.match(FORM_ID)?.[1] ?? null,

  title(doc) {
    const og = doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim();
    if (og) return og;
    const heading = clean(doc.querySelector('[role="heading"][aria-level="1"]')?.textContent);
    if (heading) return heading;
    return clean(doc.title.replace(/\s*-\s*Google Forms$/i, '')) || null;
  },

  formUrl: (url) =>
    url.origin + url.pathname.replace(/\/(formResponse|viewform|closedform)\/?$/, '/viewform'),

  isConfirmation(doc, url) {
    // Signal A: "Submit another response" link only exists after a real submit.
    if (doc.querySelector('a[href*="usp=form_confirm"]')) return true;
    // Signal B: on /formResponse with no questions left. A failed validation also lands on
    // /formResponse, but it still shows the questions.
    const onResponse = /\/formResponse\/?$/.test(url.pathname);
    return onResponse && !!doc.body?.childElementCount && !doc.querySelector(QUESTION);
  },

  captureAnswers(doc) {
    const answers: Answer[] = [];
    for (const item of doc.querySelectorAll<HTMLElement>(QUESTION)) {
      const question = questionText(item);
      if (!question) continue; // section headers, images and videos are list items too
      answers.push({ question, value: readValue(item) });
    }
    return answers;
  },
};

function questionText(item: Element): string {
  const heading = item.querySelector('[role="heading"]');
  if (!heading) return '';
  const copy = heading.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-label="Required question"]').forEach((el) => el.remove());
  return clean(copy.textContent).replace(/\s*\*$/, '');
}

function readValue(item: HTMLElement): string {
  // Grids: one radiogroup/group per row, each labelled with the row name.
  const rows = [...item.querySelectorAll('[role="radiogroup"][aria-label], [role="group"][aria-label]')]
    .filter((row) => row.querySelector(CHOICE));
  if (rows.length > 1) {
    return rows
      .map((row) => {
        const picked = pickedChoices(row, item);
        return picked.length ? `${row.getAttribute('aria-label')} → ${picked.join(', ')}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }

  const picked = pickedChoices(item, item);
  const selected = [...item.querySelectorAll('[role="option"][aria-selected="true"]')]
    .map((el) => el.getAttribute('data-value') ?? '')
    .filter(Boolean);
  const typed = typedValues(item);

  const values = [...picked, ...selected, ...typed];
  if (values.length) return values.join(', ');

  // Fallback: Google mirrors chosen values into hidden inputs named entry.<id>.
  return [...item.querySelectorAll<HTMLInputElement>('input[type="hidden"][name^="entry."]')]
    .filter((el) => !/_sentinel$|\.other_option_response$/.test(el.name))
    .map((el) => el.value.trim())
    .filter((v) => v && v !== OTHER_OPTION)
    .join(', ');
}

function pickedChoices(scope: Element, item: Element): string[] {
  return [...scope.querySelectorAll(CHOICE)]
    .filter((el) => el.getAttribute('aria-checked') === 'true')
    .map((el) => {
      const value =
        el.getAttribute('data-value') ??
        el.getAttribute('data-answer-value') ??
        el.getAttribute('aria-label') ??
        clean(el.textContent);
      if (value === OTHER_OPTION) {
        const other = item.querySelector<HTMLInputElement>('input[aria-label="Other response"]');
        return other?.value.trim() ? `Other: ${other.value.trim()}` : 'Other';
      }
      return value;
    })
    .filter(Boolean);
}

function typedValues(item: Element): string[] {
  const inputs = [...item.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TYPED)].filter(
    (el) => el.getAttribute('aria-label') !== 'Other response',
  );
  const hour = inputs.find((el) => el.getAttribute('aria-label') === 'Hour');
  const minute = inputs.find((el) => el.getAttribute('aria-label') === 'Minute');
  const rest = inputs.filter((el) => el !== hour && el !== minute).map((el) => el.value.trim());
  if (hour?.value && minute?.value) rest.push(`${hour.value.padStart(2, '0')}:${minute.value.padStart(2, '0')}`);
  return rest.filter(Boolean);
}

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}
