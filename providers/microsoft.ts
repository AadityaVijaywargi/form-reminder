import { clean, cleanQuestion, readControls } from './read-controls';
import type { Answer, ProviderAdapter } from './types';

// UNVERIFIED against a live form: no public Microsoft Form was reachable without signing in
// while building this. Selectors follow Microsoft Forms' data-automation-id attributes;
// check them on a real form (test T10) and fix here if they differ.
const QUESTION = '[data-automation-id="questionItem"]';
const QUESTION_TITLE = '[data-automation-id="questionTitle"]';
const SHORT_ID = /\/(?:r|e)\/([\w-]+)/;

export const microsoft: ProviderAdapter = {
  id: 'microsoft',
  name: 'Microsoft Forms',
  matches: ['https://forms.office.com/*', 'https://forms.microsoft.com/*', 'https://forms.cloud.microsoft/*'],

  submitRequest: {
    urls: [
      'https://forms.office.com/formapi/*',
      'https://forms.microsoft.com/formapi/*',
      'https://forms.cloud.microsoft/formapi/*',
    ],
    formId: (url) => decodeURIComponent(url).match(/forms\('([^']+)'\)\/responses/)?.[1] ?? null,
  },

  formId(url) {
    if (/design|analysis|share/i.test(url.pathname)) return null; // owner pages, not responding
    return url.searchParams.get('id') ?? url.pathname.match(SHORT_ID)?.[1] ?? null;
  },

  title(doc) {
    return (
      clean(doc.querySelector('[data-automation-id="formTitle"]')?.textContent) ||
      clean(doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content) ||
      clean(doc.title.replace(/\s*[-|]\s*Microsoft Forms$/i, '')) ||
      null
    );
  },

  formUrl(url) {
    const id = url.searchParams.get('id');
    return id ? `${url.origin}/Pages/ResponsePage.aspx?id=${encodeURIComponent(id)}` : url.origin + url.pathname;
  },

  isConfirmation(doc, _url, ctx) {
    if (doc.querySelector('[data-automation-id="thankYouMessage"], [data-automation-id="submitAnother"]')) {
      return true;
    }
    return ctx.sawQuestions && !doc.querySelector(QUESTION);
  },
  settleMs: 1500,

  captureAnswers(doc) {
    const answers: Answer[] = [];
    for (const item of doc.querySelectorAll(QUESTION)) {
      const question = cleanQuestion(item.querySelector(QUESTION_TITLE)?.textContent);
      if (!question) continue;
      answers.push({ question, value: readControls(item) });
    }
    return answers;
  },
};
