import { clean, cleanQuestion, readControls } from './read-controls';
import type { Answer, ProviderAdapter } from './types';

// Checked against live Tally forms (Oct 2026): the form is a flat list of blocks
// (div[data-block-type]). A question is a TITLE block whose h3 has id "label_<uuid>"; its
// answer controls are the blocks that follow, up to the next TITLE / page break.
const BLOCK = '[data-block-type]';
const QUESTION_TITLE = 'form [data-block-type="TITLE"] h3[id^="label_"]';
const STOP = new Set(['TITLE', 'FORM_TITLE', 'PAGE_BREAK', 'THANK_YOU_PAGE', 'DIVIDER', 'HEADING_1', 'HEADING_2', 'HEADING_3']);
const FORM_ID = /\/(?:r|embed|forms)\/([\w-]+)/;

export const tally: ProviderAdapter = {
  id: 'tally',
  name: 'Tally',
  matches: ['https://tally.so/r/*', 'https://tally.so/embed/*'],

  // UNVERIFIED: endpoint inferred from Tally's API layout; the DOM rule below is the backup.
  submitRequest: {
    urls: ['https://api.tally.so/forms/*', 'https://tally.so/api/forms/*'],
    formId: (url) => url.match(/\/forms\/([\w-]+)\/respond(?:[/?]|$)/)?.[1] ?? null,
  },

  formId: (url) => url.pathname.match(FORM_ID)?.[1] ?? null,

  title(doc) {
    return (
      clean(doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content) ||
      clean(doc.querySelector('[data-block-type="FORM_TITLE"] h1')?.textContent) ||
      clean(doc.title) ||
      null
    );
  },

  formUrl: (url) => `https://tally.so/r/${url.pathname.match(FORM_ID)?.[1] ?? ''}`,

  isConfirmation(doc, _url, ctx) {
    if (doc.querySelector('[data-block-type="THANK_YOU_PAGE"]')) return true;
    // Single-page app: questions were on screen and now the form is gone.
    return ctx.sawQuestions && !doc.querySelector(`${QUESTION_TITLE}, form input, form textarea`);
  },
  settleMs: 1200,

  captureAnswers(doc) {
    const answers: Answer[] = [];
    for (const heading of doc.querySelectorAll(QUESTION_TITLE)) {
      const question = cleanQuestion(heading.textContent);
      const titleBlock = heading.closest(BLOCK);
      if (!question || !titleBlock) continue;
      const values: string[] = [];
      for (let block = titleBlock.nextElementSibling; block; block = block.nextElementSibling) {
        const type = block.getAttribute('data-block-type');
        if (type && STOP.has(type)) break;
        const v = readControls(block);
        if (v) values.push(v);
      }
      answers.push({ question, value: values.join(', ') });
    }
    return answers;
  },
};
