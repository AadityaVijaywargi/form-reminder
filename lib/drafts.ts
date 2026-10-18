import { browser } from 'wxt/browser';
import type { Answer, ProviderId } from '@/providers/types';

// Answers collected while the user moves through a form. Kept in storage.session (memory
// only, wiped when the browser closes) and deleted once the receipt is queued.

export interface Draft {
  title: string | null;
  url: string | null;
  answers: Answer[];
  updatedAt: number;
}

const DRAFT_TTL_MS = 24 * 60 * 60_000;

const keyOf = (provider: ProviderId, formId: string) => `draft:${provider}:${formId}`;

/**
 * Merge the questions visible right now into the draft. Visible questions replace earlier
 * values (so a cleared or changed answer wins); questions from other sections are kept.
 */
export function mergeAnswers(previous: Answer[], visible: Answer[]): Answer[] {
  const seen = new Set(visible.map((a) => a.question));
  const kept = previous.filter((a) => !seen.has(a.question));
  // Keep form order: earlier sections first, then the current section.
  return [...kept, ...visible];
}

export async function saveDraft(
  provider: ProviderId,
  formId: string,
  page: { title: string | null; url?: string | null; answers: Answer[] },
  now = Date.now(),
): Promise<Draft> {
  const key = keyOf(provider, formId);
  const previous = (await browser.storage.session.get(key))[key] as Draft | undefined;
  const fresh = previous && now - previous.updatedAt < DRAFT_TTL_MS ? previous : undefined;
  const draft: Draft = {
    title: page.title ?? fresh?.title ?? null,
    url: page.url ?? fresh?.url ?? null,
    answers: mergeAnswers(fresh?.answers ?? [], page.answers),
    updatedAt: now,
  };
  await browser.storage.session.set({ [key]: draft });
  return draft;
}

/** Read and delete the draft in one go. */
export async function takeDraft(provider: ProviderId, formId: string): Promise<Draft | undefined> {
  const key = keyOf(provider, formId);
  const draft = (await browser.storage.session.get(key))[key] as Draft | undefined;
  await browser.storage.session.remove(key);
  return draft;
}
