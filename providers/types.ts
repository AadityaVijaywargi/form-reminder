export type ProviderId = 'google' | 'microsoft' | 'typeform' | 'jotform' | 'tally';

export interface Answer {
  question: string;
  /** Already formatted for display, e.g. "Vegetarian, No nuts". Empty string = unanswered. */
  value: string;
}

/** What the watcher has seen on this page so far. */
export interface WatchContext {
  /** Questions were visible at some point (lets single-page apps detect "questions gone"). */
  sawQuestions: boolean;
}

export interface ProviderAdapter {
  id: ProviderId;
  /** Human name shown in emails and the popup. */
  name: string;
  /** Match patterns for the content script (it also runs inside iframes). */
  matches: string[];

  /**
   * Network signal, watched by the background via webRequest: a completed POST to one of
   * `urls` whose URL yields a form id. Leave undefined when the request is ambiguous
   * (Google POSTs /formResponse on every "Next").
   */
  submitRequest?: {
    urls: string[];
    formId(requestUrl: string): string | null;
    /** Count only a redirect, not a 200: the submit URL can also serve an interim page (captcha). */
    redirectOnly?: boolean;
  };

  /** Form id from the page URL. Must equal submitRequest.formId for the same form. */
  formId(url: URL): string | null;
  title(doc: Document): string | null;
  /** Canonical link to the form for the receipt. */
  formUrl(url: URL): string;

  /** DOM signal: the confirmation / thank-you screen is showing. */
  isConfirmation(doc: Document, url: URL, ctx: WatchContext): boolean;
  /**
   * How long isConfirmation must stay true before it counts. Single-page apps briefly
   * show no questions while moving between screens.
   */
  settleMs?: number;

  /**
   * Every question currently visible, including unanswered ones (value ""), so the draft can
   * drop answers the user cleared.
   */
  captureAnswers(doc: Document): Answer[];
}
