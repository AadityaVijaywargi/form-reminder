import { clean, cleanQuestion, readControls } from './read-controls';
import type { Answer, ProviderAdapter } from './types';

// Checked against a live classic Jotform (Oct 2026): <form action="https://submit.jotform.com/
// submit/<id>" method="post">, one li.form-line[data-type] per field, titled by .form-label
// (a <label> for text fields, a <span> for radio and checkbox questions). After submit the
// browser lands on submit.jotform.com/submit/<id>/ (the thank-you page) unless the owner set a
// redirect, which the network signal still catches. Jotform may first answer that POST with an
// hCaptcha check on the same URL, so only a redirect counts as a network submit. Solving it
// posts to submit.jotform.com/server.php and lands on submit.jotform.com/<id> (no /submit/), which
// only the DOM signal sees.
const LINE = 'li.form-line';
const SKIP_TYPES = new Set([
  'control_button',
  'control_head',
  'control_text',
  'control_divider',
  'control_pagebreak',
  'control_collapse',
  'control_captcha',
  'control_image',
]);
const FORM_ID = /\/(?:submit\/|form\/)?(\d{10,})/;

export const jotform: ProviderAdapter = {
  id: 'jotform',
  name: 'Jotform',
  matches: [
    'https://form.jotform.com/*',
    'https://submit.jotform.com/*',
    'https://eu.jotform.com/*',
    'https://www.jotform.com/form/*',
  ],

  submitRequest: {
    urls: ['https://submit.jotform.com/submit/*', 'https://eu-submit.jotform.com/submit/*'],
    formId: (url) => url.match(/\/submit\/(\d{10,})/)?.[1] ?? null,
    redirectOnly: true,
  },

  formId: (url) => url.pathname.match(FORM_ID)?.[1] ?? null,

  title(doc) {
    if (/submit\.jotform\.com$/.test(doc.location?.hostname ?? '')) return null; // "Thank You" page
    return (
      clean(doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content) ||
      clean(doc.querySelector('.form-header')?.textContent) ||
      clean(doc.title) ||
      null
    );
  },

  formUrl(url) {
    const host = url.hostname.endsWith('submit.jotform.com') ? 'form.jotform.com' : url.hostname;
    return `https://${host}/${url.pathname.match(FORM_ID)?.[1] ?? ''}`;
  },

  isConfirmation(doc, url) {
    const onSubmitPage =
      /(^|\.|-)submit\.jotform\.com$/.test(url.hostname) && /^\/(?:submit\/)?\d{10,}\/?$/.test(url.pathname);
    // A server-side validation error re-renders the form on the same URL.
    return onSubmitPage && !!doc.body?.childElementCount && !doc.querySelector(LINE);
  },

  captureAnswers(doc) {
    const answers: Answer[] = [];
    for (const line of doc.querySelectorAll<HTMLElement>(LINE)) {
      const type = line.dataset.type ?? '';
      if (SKIP_TYPES.has(type)) continue;
      const question = cleanQuestion(line.querySelector('.form-label')?.textContent);
      if (!question) continue;
      const input = line.querySelector('.form-input, .form-input-wide') ?? line;
      answers.push({ question, value: readControls(input, type === 'control_fullname' ? ' ' : ', ') });
    }
    return answers;
  },
};
