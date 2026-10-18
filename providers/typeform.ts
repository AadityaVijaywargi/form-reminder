import { clean, cleanQuestion, readControls } from './read-controls';
import type { Answer, ProviderAdapter } from './types';

// Checked against a live Typeform (Oct 2026): each question is an element with
// data-qa-blockref="<uuid>" and its title is #<uuid>-title. Typeform shows one question at a
// time (and pre-renders the next), so answers are collected screen by screen into the draft.
const BLOCK = '[data-qa-blockref]';
const FORM_ID = /\/to\/([\w-]+)/;

export const typeform: ProviderAdapter = {
  id: 'typeform',
  name: 'Typeform',
  matches: ['https://*.typeform.com/to/*'],

  // UNVERIFIED: the renderer finishes a response with POST /forms/<id>/complete-submission.
  submitRequest: {
    urls: ['https://api.typeform.com/forms/*', 'https://*.typeform.com/forms/*'],
    formId: (url) => url.match(/\/forms\/([\w-]+)\/complete-submission/)?.[1] ?? null,
  },

  formId: (url) => url.pathname.match(FORM_ID)?.[1] ?? null,

  title(doc) {
    return (
      clean(doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content) ||
      clean(doc.title.split(' | ')[0]) ||
      null
    );
  },

  formUrl: (url) => `${url.origin}/to/${url.pathname.match(FORM_ID)?.[1] ?? ''}`,

  isConfirmation(doc, _url, ctx) {
    // UNVERIFIED selector names for the ending screen; the "questions gone" rule backs them up.
    if (doc.querySelector('[data-qa*="thankyou-screen"], [data-qa*="thank-you-screen"], [data-qa*="ending-screen"]')) {
      return true;
    }
    return ctx.sawQuestions && !doc.querySelector(BLOCK);
  },
  settleMs: 1500,

  captureAnswers(doc) {
    const answers: Answer[] = [];
    for (const block of doc.querySelectorAll(BLOCK)) {
      const ref = block.getAttribute('data-qa-blockref') ?? '';
      const title = doc.getElementById(`${ref}-title`) ?? block.querySelector('[data-qa*="block-title"]');
      const question = cleanQuestion(title?.textContent);
      if (!question) continue;
      answers.push({ question, value: readControls(block) });
    }
    return answers;
  },
};
