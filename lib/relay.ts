import type { Answer, ProviderId } from '@/providers/types';

// Client for the relay API. One URL, JSON body with an "action" field, so the same client
// works for the Apps Script relay today and a Cloudflare Worker + Resend relay later.

export type RelayError =
  | 'not_configured'
  | 'network'
  | 'bad_response'
  | 'bad_email'
  | 'bad_code'
  | 'unknown_token'
  | 'rate_limited'
  | 'busy'
  | 'unknown_action'
  | 'bad_json'
  | (string & {});

export type RelayResult<T = object> = ({ ok: true } & T) | { ok: false; error: RelayError };

export interface ReceiptPayload {
  token: string;
  provider: ProviderId;
  providerName: string;
  title: string;
  url: string;
  submittedAt: string;
  submittedAtText: string;
  /** null when the user turned answers off. */
  answers: Answer[] | null;
  test?: boolean;
}

export async function callRelay<T = object>(
  relayUrl: string,
  action: string,
  payload: object,
  fetchImpl: typeof fetch = fetch,
): Promise<RelayResult<T>> {
  if (!relayUrl) return { ok: false, error: 'not_configured' };
  let res: Response;
  try {
    res = await fetchImpl(relayUrl, {
      method: 'POST',
      // text/plain keeps this a "simple" request; Apps Script reads the raw body either way.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
    });
  } catch {
    return { ok: false, error: 'network' };
  }
  try {
    const data = (await res.json()) as RelayResult<T>;
    if (typeof data?.ok !== 'boolean') return { ok: false, error: 'bad_response' };
    return data;
  } catch {
    return { ok: false, error: res.ok ? 'bad_response' : 'network' };
  }
}

export const relay = {
  verifyStart: (url: string, email: string) => callRelay(url, 'verify_start', { email }),
  verifyConfirm: (url: string, email: string, code: string) =>
    callRelay<{ token: string }>(url, 'verify_confirm', { email, code }),
  receipt: (url: string, payload: ReceiptPayload) =>
    callRelay<{ quota?: number }>(url, 'receipt', payload),
  remove: (url: string, token: string) => callRelay(url, 'delete', { token }),
};
