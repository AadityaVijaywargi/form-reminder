import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { google } from '@/providers/google';
import type { DraftMessage, SubmittedMessage } from '@/lib/messages';
import { watchForm } from '@/lib/watcher';
import { tally } from '@/providers/tally';
import { RESPONSE_URL, VIEWFORM_URL, confirmation, midForm, viewform } from './fixtures/google';
import { TALLY_URL, tallyForm } from './fixtures/providers';

type Sent = DraftMessage | SubmittedMessage;

function mount(html: string) {
  document.open();
  document.write(html);
  document.close();
}

describe('watchForm', () => {
  let sent: Sent[];
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
  });
  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
  });

  const start = (pageUrl: string) => {
    cleanup = watchForm(google, { getUrl: () => new URL(pageUrl), send: (m) => sent.push(m) });
  };

  it('sends a draft as the user types, without reporting a submit', async () => {
    mount(viewform);
    start(VIEWFORM_URL);
    sent = []; // ignore the initial empty snapshot

    const input = document.querySelector<HTMLInputElement>('#q-team input')!;
    input.value = 'Null Pointers';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(400);

    expect(sent).toHaveLength(1);
    const draft = sent[0] as DraftMessage;
    expect(draft.type).toBe('DRAFT');
    expect(draft.formId).toBe('1FAIpQLSdTEST123');
    expect(draft.title).toBe('Hackathon Registration 2026');
    expect(draft.answers.find((a) => a.question === 'Team name')?.value).toBe('Null Pointers');
  });

  it('does not send duplicate drafts when nothing changed', async () => {
    mount(viewform);
    start(VIEWFORM_URL);
    sent = [];
    document.body.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(400);
    expect(sent).toHaveLength(0);
  });

  it('never reports a submit on the mid-form "Next" page', async () => {
    mount(midForm);
    start(RESPONSE_URL);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent.some((m) => m.type === 'FORM_SUBMITTED')).toBe(false);
  });

  it('reports the confirmation page exactly once', async () => {
    mount(confirmation);
    start(RESPONSE_URL);
    document.body.append(document.createElement('div')); // later DOM churn
    await vi.advanceTimersByTimeAsync(1000);
    const submits = sent.filter((m) => m.type === 'FORM_SUBMITTED') as SubmittedMessage[];
    expect(submits).toHaveLength(1);
    expect(submits[0]).toMatchObject({
      provider: 'google',
      formId: '1FAIpQLSdTEST123',
      title: 'Hackathon Registration 2026',
      url: VIEWFORM_URL,
    });
  });

  it('catches a confirmation screen that renders after load', async () => {
    mount(midForm);
    start(RESPONSE_URL);
    await vi.advanceTimersByTimeAsync(300);
    expect(sent.some((m) => m.type === 'FORM_SUBMITTED')).toBe(false);
    document.querySelector('form')!.replaceWith(
      Object.assign(document.createElement('div'), { textContent: 'Your response has been recorded.' }),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect(sent.filter((m) => m.type === 'FORM_SUBMITTED')).toHaveLength(1);
  });
});

describe('watchForm on single-page apps (Tally)', () => {
  let sent: Sent[];
  let cleanup: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
  });
  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
  });

  const start = () => {
    mount(tallyForm);
    cleanup = watchForm(tally, { getUrl: () => new URL(TALLY_URL), send: (m) => sent.push(m) });
  };
  const submits = () => sent.filter((m) => m.type === 'FORM_SUBMITTED');

  it('ignores a brief blank between screens', async () => {
    start();
    const form = document.querySelector('form')!;
    form.remove();
    await vi.advanceTimersByTimeAsync(500);
    document.body.append(form);
    await vi.advanceTimersByTimeAsync(3000);
    expect(submits()).toHaveLength(0);
  });

  it('reports once the thank-you screen has stayed up, with the form link in the draft', async () => {
    start();
    const draft = sent.find((m) => m.type === 'DRAFT') as DraftMessage;
    expect(draft.url).toBe(TALLY_URL);
    document.querySelector('form')!.replaceWith(
      Object.assign(document.createElement('div'), { textContent: 'Thanks for completing this form!' }),
    );
    await vi.advanceTimersByTimeAsync(800);
    expect(submits()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(submits()).toHaveLength(1);
    expect(submits()[0]).toMatchObject({ provider: 'tally', formId: 'Vw2e3O', url: TALLY_URL });
  });
});
