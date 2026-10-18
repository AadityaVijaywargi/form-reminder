import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { mergeAnswers, saveDraft, takeDraft } from '@/lib/drafts';
import { formatSubmittedAt, timeAgo } from '@/lib/format';
import { MASK, maskAnswers } from '@/lib/mask';
import { DEDUPE_MS, HISTORY_MAX, MAX_AGE_MS, drain, enqueue, getHistory, getQueue, type Job } from '@/lib/queue';
import { callRelay } from '@/lib/relay';
import { buildPayload, sendJob } from '@/lib/sender';
import { DEFAULT_SETTINGS } from '@/lib/settings';

const sub = (formId = 'F1') => ({
  provider: 'google' as const,
  formId,
  title: 'Club Form',
  url: 'https://docs.google.com/forms/d/e/F1/viewform',
  answers: [{ question: 'Name', value: 'Aadi' }],
});

beforeEach(() => fakeBrowser.reset());

describe('mask', () => {
  it('hides secrets by question wording and card numbers by Luhn check', () => {
    const out = maskAnswers([
      { question: 'Portal password', value: 'hunter2' },
      { question: 'Enter OTP', value: '123456' },
      { question: 'Aadhaar number', value: '1234 5678 9012' },
      { question: 'Anything else?', value: '4111 1111 1111 1111' },
      { question: 'Phone', value: '9876543210' },
      { question: 'Name', value: 'Aadi' },
      { question: 'Password', value: '' },
    ]);
    expect(out.map((a) => a.value)).toEqual([MASK, MASK, MASK, MASK, '9876543210', 'Aadi', '']);
  });
});

describe('format', () => {
  it('formats date, time and zone without throwing', () => {
    const text = formatSubmittedAt(new Date('2026-10-18T05:12:00Z'), 'en-IN', 'Asia/Kolkata');
    expect(text).toContain('Sunday');
    expect(text).toContain('18 October 2026');
    expect(text).toMatch(/10:42/);
    expect(text).toMatch(/IST|GMT\+5:30/);
  });

  it('describes elapsed time', () => {
    expect(timeAgo(0, 30_000)).toBe('just now');
    expect(timeAgo(0, 5 * 60_000)).toBe('5 min ago');
    expect(timeAgo(0, 3 * 3600_000)).toBe('3 h ago');
    expect(timeAgo(0, 50 * 3600_000)).toBe('2 days ago');
  });
});

describe('drafts', () => {
  it('replaces visible questions and keeps earlier sections in order', () => {
    const merged = mergeAnswers(
      [
        { question: 'Name', value: 'A' },
        { question: 'College', value: 'X' },
      ],
      [
        { question: 'College', value: '' },
        { question: 'Year', value: '3' },
      ],
    );
    expect(merged).toEqual([
      { question: 'Name', value: 'A' },
      { question: 'College', value: '' },
      { question: 'Year', value: '3' },
    ]);
  });

  it('accumulates across sections, then is consumed exactly once', async () => {
    await saveDraft('google', 'F1', { title: 'Club Form', url: 'https://x.test/f', answers: [{ question: 'Name', value: 'Aadi' }] });
    await saveDraft('google', 'F1', { title: null, answers: [{ question: 'Year', value: '3' }] });
    const draft = await takeDraft('google', 'F1');
    expect(draft?.title).toBe('Club Form');
    expect(draft?.url).toBe('https://x.test/f');
    expect(draft?.answers).toEqual([
      { question: 'Name', value: 'Aadi' },
      { question: 'Year', value: '3' },
    ]);
    expect(await takeDraft('google', 'F1')).toBeUndefined();
  });

  it('ignores drafts older than a day', async () => {
    await saveDraft('google', 'F1', { title: 'Old', answers: [{ question: 'Name', value: 'old' }] }, 0);
    const draft = await saveDraft('google', 'F1', { title: null, answers: [{ question: 'Year', value: '3' }] }, 25 * 3600_000);
    expect(draft.answers).toEqual([{ question: 'Year', value: '3' }]);
    expect(draft.title).toBeNull();
  });
});

describe('queue', () => {
  it('drops a second submit of the same form within a minute', async () => {
    expect(await enqueue(sub(), 1000)).not.toBeNull();
    expect(await enqueue(sub(), 1000 + DEDUPE_MS - 1)).toBeNull();
    expect(await enqueue(sub('F2'), 2000)).not.toBeNull();
    expect(await enqueue(sub(), 1000 + DEDUPE_MS + 1)).not.toBeNull();
    expect(await getQueue()).toHaveLength(3);
  });

  it('removes sent jobs and records history + last receipt time', async () => {
    await enqueue(sub(), 0);
    const sent = await drain(async () => 'sent', { now: 10 });
    expect(sent).toHaveLength(1);
    expect(await getQueue()).toEqual([]);
    expect((await getHistory())[0]?.status).toBe('sent');
    expect((await fakeBrowser.storage.local.get('lastReceiptAt')).lastReceiptAt).toBe(10);
  });

  it('backs off exponentially on retry and waits an hour on quota or missing setup', async () => {
    await enqueue(sub('A'), 0);
    await enqueue(sub('B'), 0);
    await enqueue(sub('C'), 0);
    const outcome = { A: 'retry', B: 'quota', C: 'needs_setup' } as const;
    await drain(async (job) => outcome[job.formId as 'A' | 'B' | 'C'], { now: 0 });
    const byId = Object.fromEntries((await getQueue()).map((j) => [j.formId, j]));
    expect(byId.A).toMatchObject({ status: 'retrying', attempts: 1, nextAttemptAt: 60_000 });
    expect(byId.B).toMatchObject({ status: 'waiting_quota', nextAttemptAt: 3600_000 });
    expect(byId.C).toMatchObject({ status: 'needs_setup', nextAttemptAt: 3600_000 });

    // Not due yet: untouched. Forced: retried.
    const send = vi.fn(async () => 'sent' as const);
    await drain(send, { now: 30_000 });
    expect(send).not.toHaveBeenCalled();
    await drain(send, { now: 30_000, force: true });
    expect(send).toHaveBeenCalledTimes(3);
    expect(await getQueue()).toEqual([]);
  });

  it('treats a throwing sender as a retry', async () => {
    await enqueue(sub(), 0);
    await drain(async () => {
      throw new Error('boom');
    }, { now: 0 });
    expect((await getQueue())[0]?.status).toBe('retrying');
  });

  it('gives up after a week', async () => {
    await enqueue(sub(), 0);
    await drain(async () => 'retry', { now: MAX_AGE_MS + 1 });
    expect(await getQueue()).toEqual([]);
    expect((await getHistory())[0]?.status).toBe('failed');
  });

  it('caps history', async () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) await enqueue(sub(`F${i}`), i);
    expect(await getHistory()).toHaveLength(HISTORY_MAX);
  });

  it('runs one drain at a time', async () => {
    await enqueue(sub(), 0);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const send = vi.fn(async () => {
      await gate;
      return 'sent' as const;
    });
    const first = drain(send, { now: 0 });
    const second = drain(send, { now: 0 });
    release();
    await Promise.all([first, second]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('sender', () => {
  const job: Job = {
    ...sub(),
    answers: [
      { question: 'Name', value: 'Aadi' },
      { question: 'Skipped', value: '' },
      { question: 'Password', value: 'x' },
    ],
    id: 'j1',
    submittedAt: Date.parse('2026-10-18T05:12:00Z'),
    attempts: 0,
    nextAttemptAt: 0,
    status: 'queued',
  };
  const ready = { ...DEFAULT_SETTINGS, token: 'tok', relayUrl: 'https://relay.test/exec' };

  it('builds the payload with masked, non-empty answers', () => {
    const p = buildPayload(job, ready);
    expect(p).toMatchObject({ token: 'tok', providerName: 'Google Forms', title: 'Club Form' });
    expect(p.submittedAt).toBe('2026-10-18T05:12:00.000Z');
    expect(p.answers).toEqual([
      { question: 'Name', value: 'Aadi' },
      { question: 'Password', value: MASK },
    ]);
  });

  it('sends null answers when the user turned them off', () => {
    expect(buildPayload(job, { ...ready, includeAnswers: false }).answers).toBeNull();
  });

  it('maps relay replies to queue outcomes', async () => {
    const reply = (r: object) => async () => r as never;
    expect(await sendJob(job, { ...DEFAULT_SETTINGS })).toBe('needs_setup');
    expect(await sendJob(job, ready, reply({ ok: true }))).toBe('sent');
    expect(await sendJob(job, ready, reply({ ok: false, error: 'busy' }))).toBe('quota');
    expect(await sendJob(job, ready, reply({ ok: false, error: 'rate_limited' }))).toBe('quota');
    expect(await sendJob(job, ready, reply({ ok: false, error: 'unknown_token' }))).toBe('needs_setup');
    expect(await sendJob(job, ready, reply({ ok: false, error: 'network' }))).toBe('retry');
  });
});

describe('relay client', () => {
  it('posts the action as text/plain JSON and returns the reply', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, token: 't' })));
    const res = await callRelay('https://relay.test/exec', 'verify_confirm', { email: 'a@b.co' }, fetchImpl);
    expect(res).toEqual({ ok: true, token: 't' });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ action: 'verify_confirm', email: 'a@b.co' });
  });

  it('reports missing config, network failures and non-JSON replies', async () => {
    expect(await callRelay('', 'x', {})).toEqual({ ok: false, error: 'not_configured' });
    const offline = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await callRelay('https://r.test', 'x', {}, offline)).toEqual({ ok: false, error: 'network' });
    const html = vi.fn(async () => new Response('<html>Sign in</html>'));
    expect(await callRelay('https://r.test', 'x', {}, html)).toEqual({ ok: false, error: 'bad_response' });
  });
});
