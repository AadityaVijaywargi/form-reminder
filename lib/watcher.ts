import type { ProviderAdapter, WatchContext } from '@/providers/types';
import type { DraftMessage, SubmittedMessage } from './messages';

export interface WatchOptions {
  doc?: Document;
  win?: Window;
  getUrl?: () => URL;
  send: (msg: DraftMessage | SubmittedMessage) => void;
}

/**
 * Watch one form page: keep the background's draft of answers up to date while the user
 * fills it in, and report once when the confirmation screen appears. Returns a cleanup fn.
 */
export function watchForm(adapter: ProviderAdapter, opts: WatchOptions): () => void {
  const doc = opts.doc ?? document;
  const win = opts.win ?? window;
  const getUrl = opts.getUrl ?? (() => new URL(win.location.href));
  const formId = adapter.formId(getUrl());
  if (!formId) return () => {};

  const ctx: WatchContext = { sawQuestions: false };
  const settleMs = adapter.settleMs ?? 0;
  let fired = false;
  let confirmedSince: number | undefined;
  let lastDraft = '';
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const snapshot = () => {
    if (fired) return;
    const answers = adapter.captureAnswers(doc);
    if (!answers.length) return;
    ctx.sawQuestions = true;
    const title = adapter.title(doc);
    const key = JSON.stringify([title, answers]);
    if (key === lastDraft) return;
    lastDraft = key;
    opts.send({ type: 'DRAFT', provider: adapter.id, formId, title, url: adapter.formUrl(getUrl()), answers });
  };

  const scheduleSnapshot = (delay: number) => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(snapshot, delay);
  };

  const check = () => {
    if (fired) return;
    const url = getUrl();
    if (!adapter.isConfirmation(doc, url, ctx)) {
      confirmedSince = undefined;
      // Still on the form: keep the draft fresh (single-page apps swap questions without events).
      if (adapter.settleMs) snapshot();
      return;
    }
    const now = Date.now();
    confirmedSince ??= now;
    if (now - confirmedSince < settleMs) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(check, settleMs - (now - confirmedSince));
      return;
    }
    fired = true;
    opts.send({
      type: 'FORM_SUBMITTED',
      provider: adapter.id,
      formId,
      title: adapter.title(doc),
      url: adapter.formUrl(url),
      answers: [],
    });
    cleanup();
  };

  const scheduleCheck = () => {
    if (checkTimer) return;
    checkTimer = setTimeout(() => {
      checkTimer = undefined;
      check();
    }, 250);
  };

  const onInput = () => scheduleSnapshot(300);
  // Choice widgets flip aria-checked after the click handler runs, so read a moment later.
  const onClick = () => scheduleSnapshot(60);
  const onPageHide = () => snapshot();

  doc.addEventListener('input', onInput, true);
  doc.addEventListener('change', onInput, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keyup', onInput, true);
  win.addEventListener('pagehide', onPageHide);
  const observer = new MutationObserver(scheduleCheck);
  observer.observe(doc.documentElement, { childList: true, subtree: true });

  function cleanup() {
    clearTimeout(draftTimer);
    clearTimeout(checkTimer);
    clearTimeout(settleTimer);
    doc.removeEventListener('input', onInput, true);
    doc.removeEventListener('change', onInput, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keyup', onInput, true);
    win.removeEventListener('pagehide', onPageHide);
    observer.disconnect();
  }

  snapshot();
  check();
  return cleanup;
}
