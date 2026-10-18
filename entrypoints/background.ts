import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { mergeAnswers, saveDraft, takeDraft } from '@/lib/drafts';
import type { Message } from '@/lib/messages';
import { drain, enqueue, getQueue, type Job } from '@/lib/queue';
import { sendJob } from '@/lib/sender';
import { getSettings } from '@/lib/settings';
import { matchSubmitRequest, submitRequestUrls } from '@/providers/registry';
import type { Answer, ProviderId } from '@/providers/types';

const DRAIN_ALARM = 'drain';
// Lets a DRAFT sent as the user clicked Submit land before the submission is handled.
const SUBMIT_SETTLE_MS = 400;

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') browser.tabs.create({ url: browser.runtime.getURL('/options.html?welcome=1') });
  });

  // sendResponse + `return true` rather than returning a promise: works in every browser.
  browser.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
    const work = handle(raw as Message);
    if (!work) return false;
    work.then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  });

  watchSubmitRequests();

  browser.alarms.create(DRAIN_ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DRAIN_ALARM) drainNow();
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.queue) updateBadge();
  });
  updateBadge();
});

function handle(msg: Message): Promise<unknown> | undefined {
  switch (msg?.type) {
    case 'DRAFT':
      return serial(() => saveDraft(msg.provider, msg.formId, msg)).then(() => ({ ok: true }));
    case 'FORM_SUBMITTED':
      return onSubmitted(msg).then(() => ({ ok: true }));
    case 'TEST_RECEIPT':
      return sendTestReceipt();
    case 'DRAIN':
      return drainNow({ force: true }).then(() => ({ ok: true }));
  }
  return undefined;
}

/**
 * Network signal: a provider's submit request finished. Not available in Safari, and not used
 * for Google (its submit URL is also hit by "Next"). Dedupe in the queue merges it with the DOM
 * signal from the content script, whichever arrives first.
 */
function watchSubmitRequests() {
  const webRequest = browser.webRequest;
  if (!webRequest || !submitRequestUrls.length) return;
  const onRequest = (redirect: boolean) => (d: { url: string; method: string; statusCode: number }) => {
    if (d.method !== 'POST' || d.statusCode >= 400) return;
    const match = matchSubmitRequest(d.url);
    if (!match || (!redirect && match.provider.submitRequest?.redirectOnly)) return;
    onSubmitted({ provider: match.provider.id, formId: match.formId, title: null, url: null, answers: [] });
  };
  const filter = { urls: submitRequestUrls };
  webRequest.onCompleted.addListener(onRequest(false), filter);
  // Jotform forms with a custom thank-you URL redirect away instead of completing.
  webRequest.onBeforeRedirect.addListener(onRequest(true), filter);
}

// Draft writes and reads go through one chain so a late DRAFT can't race the submit.
let draftChain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = draftChain.then(fn, fn);
  draftChain = run.catch(() => {});
  return run;
}

async function onSubmitted(sub: {
  provider: ProviderId;
  formId: string;
  title: string | null;
  url: string | null;
  answers: Answer[];
}) {
  await new Promise((r) => setTimeout(r, SUBMIT_SETTLE_MS));
  const draft = await serial(() => takeDraft(sub.provider, sub.formId));
  const job = await enqueue({
    provider: sub.provider,
    formId: sub.formId,
    title: sub.title || draft?.title || 'Untitled form',
    url: sub.url || draft?.url || '',
    answers: mergeAnswers(draft?.answers ?? [], sub.answers),
  });
  if (job) await drainNow();
}

async function sendTestReceipt() {
  await enqueue({
    provider: 'google',
    formId: `test-${Date.now()}`,
    title: 'Test receipt from Form Submit Receipt',
    url: 'https://docs.google.com/forms/',
    answers: [
      { question: 'Example question', value: 'Example answer' },
      { question: 'Favourite colour', value: 'Blue' },
    ],
    test: true,
  });
  const sent = await drainNow({ force: true });
  return { ok: sent.some((j) => j.test) };
}

async function drainNow(opts: { force?: boolean } = {}): Promise<Job[]> {
  const settings = await getSettings();
  const sent = await drain((job) => sendJob(job, settings), opts);
  if (settings.notify && browser.notifications) {
    for (const job of sent) {
      browser.notifications
        .create(job.id, {
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icon/128.png'),
          title: 'Receipt sent ✓',
          message: job.title,
        })
        .catch(() => {});
    }
  }
  await updateBadge();
  return sent;
}

/** "!" on the toolbar icon while receipts are stuck waiting for setup. */
async function updateBadge() {
  const queue = await getQueue();
  const stuck = queue.some((j) => j.status === 'needs_setup');
  try {
    // Badges are unsupported on some platforms (e.g. Firefox for Android).
    await browser.action.setBadgeText({ text: stuck ? '!' : queue.length ? String(queue.length) : '' });
    await browser.action.setBadgeBackgroundColor({ color: stuck ? '#d93025' : '#5f6368' });
  } catch {
    // Nothing to show; the popup's status card says the same thing.
  }
}
