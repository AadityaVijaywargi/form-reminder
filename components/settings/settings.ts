import { browser } from 'wxt/browser';
import { providerById } from '@/providers/registry';
import { timeAgo } from '@/lib/format';
import type { HistoryEntry, HistoryStatus, Job } from '@/lib/queue';
import { relay, type RelayError } from '@/lib/relay';
import { getSettings, relayUrlOf, updateSettings, type Settings } from '@/lib/settings';
import { SETTINGS_MARKUP } from './markup';
import './style.css';

const root = document.getElementById('app') as HTMLElement;
root.innerHTML = SETTINGS_MARKUP;
const inPopup = document.body.classList.contains('popup');

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

if (inPopup) {
  const openTab = $<HTMLAnchorElement>('open-tab');
  openTab.hidden = false;
  openTab.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
    window.close();
  });
}

const emailForm = $<HTMLFormElement>('email-form');
const codeForm = $<HTMLFormElement>('code-form');
const verified = $<HTMLDivElement>('verified');
const emailInput = $<HTMLInputElement>('email');
const codeInput = $<HTMLInputElement>('code');
const emailError = $<HTMLParagraphElement>('email-error');
const includeAnswers = $<HTMLInputElement>('include-answers');
const notify = $<HTMLInputElement>('notify');
const actionResult = $<HTMLParagraphElement>('action-result');
const relayInput = $<HTMLInputElement>('relay-url');

let pendingEmail = '';

const ERRORS: Record<string, string> = {
  not_configured: 'The email relay isn\'t set up in this build. Add a relay URL under Advanced.',
  network: 'Couldn\'t reach the email relay. Check your connection and try again.',
  bad_response: 'The email relay sent an unexpected reply. Check the relay URL under Advanced.',
  bad_email: 'That doesn\'t look like a valid email address.',
  bad_code: 'That code is wrong or has expired.',
  rate_limited: 'Too many attempts. Wait a while and try again.',
  busy: 'The email relay has hit its daily limit. Try again tomorrow.',
  unknown_token: 'This device is no longer verified. Enter your email again.',
};
const explain = (error: RelayError) => ERRORS[error] ?? `Something went wrong (${error}).`;

async function render() {
  const settings = await getSettings();
  const verifiedNow = !!(settings.token && settings.email);

  emailForm.hidden = verifiedNow || !!pendingEmail;
  codeForm.hidden = verifiedNow || !pendingEmail;
  verified.hidden = !verifiedNow;
  $('verified-email').textContent = settings.email ?? '';
  $('welcome').hidden = verifiedNow || !new URLSearchParams(location.search).has('welcome');
  includeAnswers.checked = settings.includeAnswers;
  notify.checked = settings.notify;
  relayInput.value = settings.relayUrl ?? '';
  // No relay yet (dev build without WXT_RELAY_URL): open Advanced so the field is visible.
  if (!relayUrlOf(settings)) (relayInput.closest('details') as HTMLDetailsElement).open = true;
  $<HTMLButtonElement>('test').disabled = !verifiedNow;

  const { queue = [], history = [], lastReceiptAt } = (await browser.storage.local.get([
    'queue',
    'history',
    'lastReceiptAt',
  ])) as { queue?: Job[]; history?: HistoryEntry[]; lastReceiptAt?: number };

  renderStatus(settings, verifiedNow, queue);
  renderHistory(history);
  $('last-receipt').textContent = lastReceiptAt ? `Last receipt ${timeAgo(lastReceiptAt)}` : '';
}

function renderStatus(settings: Settings, verifiedNow: boolean, queue: Job[]) {
  const status = $('status');
  const stuck = queue.filter((j) => j.status === 'needs_setup').length;
  const waiting = queue.length - stuck;
  let pill: string;
  let text: string;
  if (!relayUrlOf(settings)) {
    pill = '<span class="pill err">Not ready</span>';
    text = 'No email relay set. Paste your Apps Script /exec URL under Advanced (bottom of this page).';
  } else if (!verifiedNow) {
    pill = '<span class="pill warn">One step left</span>';
    text = stuck
      ? `Verify your email to send ${stuck} waiting receipt${stuck > 1 ? 's' : ''}.`
      : 'Verify your email to start getting receipts.';
  } else if (waiting) {
    pill = '<span class="pill warn">Sending</span>';
    text = `${waiting} receipt${waiting > 1 ? 's' : ''} waiting to send. They'll go out automatically.`;
  } else {
    pill = '<span class="pill ok">Active</span>';
    text = 'You\'ll get an email every time you submit a form.';
  }
  status.innerHTML = pill;
  status.append(document.createTextNode(text));
}

const STATUS_LABEL: Record<HistoryStatus, [string, string]> = {
  sent: ['sent', 'ok'],
  queued: ['queued', 'warn'],
  retrying: ['retrying', 'warn'],
  waiting_quota: ['waiting', 'warn'],
  needs_setup: ['needs setup', 'err'],
  failed: ['failed', 'err'],
};

function renderHistory(history: HistoryEntry[]) {
  const list = $('history');
  list.replaceChildren();
  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No receipts yet.';
    list.append(li);
    return;
  }
  for (const h of history) {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = `${h.test ? '[Test] ' : ''}${h.title} · ${providerById(h.provider)?.name ?? h.provider}`;
    title.title = new Date(h.submittedAt).toLocaleString();
    const [label, tone] = STATUS_LABEL[h.status];
    const pill = document.createElement('span');
    pill.className = `pill ${tone}`;
    pill.textContent = label;
    li.append(title, pill);
    list.append(li);
  }
}

async function busy<T>(button: HTMLButtonElement, fn: () => Promise<T>): Promise<T> {
  button.disabled = true;
  try {
    return await fn();
  } finally {
    button.disabled = false;
  }
}

// A relay URL pasted into the email box is almost certainly meant for Advanced: save it there.
const RELAY_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/;
emailInput.addEventListener('input', async () => {
  const value = emailInput.value.trim();
  if (!RELAY_URL_RE.test(value)) return;
  await updateSettings({ relayUrl: value });
  emailInput.value = '';
  emailError.textContent = '';
  actionResult.textContent = '';
  await render();
  emailError.textContent = 'That was your relay URL. It\'s saved under Advanced. Now enter your email address.';
  emailInput.focus();
});

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  emailError.textContent = '';
  const email = emailInput.value.trim();
  const result = await busy($('send-code'), async () =>
    relay.verifyStart(relayUrlOf(await getSettings()), email),
  );
  if (!result.ok) {
    emailError.textContent = explain(result.error);
    return;
  }
  pendingEmail = email;
  await render();
  codeInput.focus();
});

codeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  emailError.textContent = '';
  const button = codeForm.querySelector('button') as HTMLButtonElement;
  const result = await busy(button, async () =>
    relay.verifyConfirm(relayUrlOf(await getSettings()), pendingEmail, codeInput.value.trim()),
  );
  if (!result.ok) {
    emailError.textContent = explain(result.error);
    return;
  }
  await updateSettings({ email: pendingEmail, token: result.token });
  pendingEmail = '';
  codeInput.value = '';
  await render();
  // Send anything that queued up before setup was finished.
  await browser.runtime.sendMessage({ type: 'DRAIN' });
  await render();
});

$('change-email').addEventListener('click', async () => {
  pendingEmail = '';
  await updateSettings({ token: undefined, email: undefined });
  await render();
  emailInput.focus();
});

includeAnswers.addEventListener('change', () => updateSettings({ includeAnswers: includeAnswers.checked }));
notify.addEventListener('change', () => updateSettings({ notify: notify.checked }));

$('test').addEventListener('click', async () => {
  actionResult.textContent = 'Sending…';
  const res = (await busy($('test'), () => browser.runtime.sendMessage({ type: 'TEST_RECEIPT' }))) as
    | { ok: boolean }
    | undefined;
  actionResult.textContent = res?.ok
    ? 'Test email sent. Check your inbox (and spam folder).'
    : 'The test email is queued and will be retried. See Recent receipts for its status.';
  await render();
});

$('delete').addEventListener('click', async () => {
  if (!confirm('Delete your email address from the relay and clear this extension\'s data?')) return;
  const settings = await getSettings();
  if (settings.token) await relay.remove(relayUrlOf(settings), settings.token);
  await browser.storage.local.clear();
  await browser.storage.session.clear();
  pendingEmail = '';
  actionResult.textContent = 'Your data was deleted.';
  await render();
});

$('save-relay').addEventListener('click', async () => {
  await updateSettings({ relayUrl: relayInput.value.trim() || undefined });
  actionResult.textContent = 'Relay URL saved.';
  await render();
});

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') render();
});

render();
