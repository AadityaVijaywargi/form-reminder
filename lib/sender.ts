import { providerById } from '@/providers/registry';
import { formatSubmittedAt } from './format';
import { maskAnswers } from './mask';
import type { Job, SendOutcome } from './queue';
import { relay, type ReceiptPayload } from './relay';
import { relayUrlOf, type Settings } from './settings';

export function buildPayload(job: Job, settings: Settings & { token: string }): ReceiptPayload {
  return {
    token: settings.token,
    provider: job.provider,
    providerName: providerById(job.provider)?.name ?? job.provider,
    title: job.title,
    url: job.url,
    submittedAt: new Date(job.submittedAt).toISOString(),
    submittedAtText: formatSubmittedAt(new Date(job.submittedAt)),
    answers: settings.includeAnswers ? maskAnswers(job.answers.filter((a) => a.value)) : null,
    ...(job.test && { test: true }),
  };
}

/** Send one job through the relay and translate the reply into a queue outcome. */
export async function sendJob(
  job: Job,
  settings: Settings,
  send: typeof relay.receipt = relay.receipt,
): Promise<SendOutcome> {
  const url = relayUrlOf(settings);
  if (!url || !settings.token) return 'needs_setup';

  const result = await send(url, buildPayload(job, { ...settings, token: settings.token }));
  if (result.ok) return 'sent';
  switch (result.error) {
    case 'unknown_token':
    case 'not_configured':
      return 'needs_setup';
    case 'busy':
    case 'rate_limited':
      return 'quota';
    default:
      return 'retry';
  }
}
