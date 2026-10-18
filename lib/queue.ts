import { browser } from 'wxt/browser';
import type { Answer, ProviderId } from '@/providers/types';

// Receipts waiting to be sent. Every job is written to storage.local *before* any network
// call, so a browser that stops the background worker mid-send can't lose it.

export interface Submission {
  provider: ProviderId;
  formId: string;
  title: string;
  url: string;
  answers: Answer[];
  test?: boolean;
}

export type JobStatus = 'queued' | 'retrying' | 'needs_setup' | 'waiting_quota';

export interface Job extends Submission {
  id: string;
  submittedAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: JobStatus;
}

export type HistoryStatus = JobStatus | 'sent' | 'failed';

export interface HistoryEntry {
  id: string;
  title: string;
  provider: ProviderId;
  submittedAt: number;
  status: HistoryStatus;
  test?: boolean;
}

export type SendOutcome = 'sent' | 'retry' | 'needs_setup' | 'quota';

export const DEDUPE_MS = 60_000;
export const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
export const HISTORY_MAX = 20;
const HOUR = 60 * 60_000;

// Serialise every read-modify-write of the queue (message handler and alarm can race).
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function read() {
  const data = await browser.storage.local.get(['queue', 'dedupe', 'history']);
  return {
    queue: (data.queue as Job[] | undefined) ?? [],
    dedupe: (data.dedupe as Record<string, number> | undefined) ?? {},
    history: (data.history as HistoryEntry[] | undefined) ?? [],
  };
}

function upsertHistory(history: HistoryEntry[], job: Job, status: HistoryStatus): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: job.id,
    title: job.title,
    provider: job.provider,
    submittedAt: job.submittedAt,
    status,
    ...(job.test && { test: true }),
  };
  return [entry, ...history.filter((h) => h.id !== job.id)].slice(0, HISTORY_MAX);
}

/** Queue a receipt. Returns null when the same form was queued less than a minute ago. */
export function enqueue(sub: Submission, now = Date.now()): Promise<Job | null> {
  return locked(async () => {
    const { queue, dedupe, history } = await read();
    for (const [k, t] of Object.entries(dedupe)) if (now - t > DEDUPE_MS) delete dedupe[k];

    const key = `${sub.provider}:${sub.formId}`;
    if (!sub.test && dedupe[key] !== undefined) return null;
    dedupe[key] = now;

    const job: Job = {
      ...sub,
      id: crypto.randomUUID(),
      submittedAt: now,
      attempts: 0,
      nextAttemptAt: now,
      status: 'queued',
    };
    await browser.storage.local.set({
      queue: [...queue, job],
      dedupe,
      history: upsertHistory(history, job, 'queued'),
    });
    return job;
  });
}

let draining: Promise<Job[]> | null = null;

/**
 * Try every due job once. `force` ignores back-off (used right after the user finishes
 * setup). Returns the jobs that were sent.
 */
export function drain(
  send: (job: Job) => Promise<SendOutcome>,
  { now = Date.now(), force = false }: { now?: number; force?: boolean } = {},
): Promise<Job[]> {
  if (draining) return draining;
  draining = (async () => {
    const due = await locked(async () =>
      (await read()).queue.filter((j) => force || j.nextAttemptAt <= now),
    );

    const outcomes: [Job, SendOutcome][] = [];
    for (const job of due) {
      let outcome: SendOutcome;
      try {
        outcome = await send(job);
      } catch {
        outcome = 'retry';
      }
      outcomes.push([job, outcome]);
    }

    return locked(async () => {
      let { queue, history } = await read();
      const sent: Job[] = [];
      let lastReceiptAt: number | undefined;

      for (const [job, outcome] of outcomes) {
        const i = queue.findIndex((j) => j.id === job.id);
        if (i < 0) continue;
        if (outcome === 'sent') {
          queue.splice(i, 1);
          history = upsertHistory(history, job, 'sent');
          sent.push(job);
          if (!job.test) lastReceiptAt = now;
          continue;
        }
        const next: Job = { ...job, attempts: job.attempts + 1 };
        if (outcome === 'retry') {
          next.status = 'retrying';
          next.nextAttemptAt = now + Math.min(2 ** job.attempts, 60) * 60_000;
        } else if (outcome === 'quota') {
          next.status = 'waiting_quota';
          next.nextAttemptAt = now + HOUR;
        } else {
          next.status = 'needs_setup';
          next.nextAttemptAt = now + HOUR;
        }
        queue[i] = next;
        history = upsertHistory(history, next, next.status);
      }

      // Give up on anything older than a week.
      for (const job of queue.filter((j) => now - j.submittedAt > MAX_AGE_MS)) {
        history = upsertHistory(history, job, 'failed');
      }
      queue = queue.filter((j) => now - j.submittedAt <= MAX_AGE_MS);

      await browser.storage.local.set({
        queue,
        history,
        ...(lastReceiptAt !== undefined && { lastReceiptAt }),
      });
      return sent;
    });
  })().finally(() => {
    draining = null;
  });
  return draining;
}

export async function getQueue(): Promise<Job[]> {
  return (await read()).queue;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return (await read()).history;
}
