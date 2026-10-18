import { google } from './google';
import { jotform } from './jotform';
import { microsoft } from './microsoft';
import { tally } from './tally';
import { typeform } from './typeform';
import type { ProviderAdapter, ProviderId } from './types';

export const providers: ProviderAdapter[] = [google, microsoft, typeform, jotform, tally];

export const contentScriptMatches = providers.flatMap((p) => p.matches);

/** Hosts the background watches for submit requests (network signal). */
export const submitRequestUrls = providers.flatMap((p) => p.submitRequest?.urls ?? []);

/** Which provider a completed POST belongs to, and the form id in it. */
export function matchSubmitRequest(url: string): { provider: ProviderAdapter; formId: string } | undefined {
  for (const provider of providers) {
    if (!provider.submitRequest) continue;
    const u = new URL(url);
    if (!provider.submitRequest.urls.some((pattern) => matchPattern(pattern, u))) continue;
    const formId = provider.submitRequest.formId(url);
    if (formId) return { provider, formId };
  }
  return undefined;
}

export function providerById(id: ProviderId): ProviderAdapter | undefined {
  return providers.find((p) => p.id === id);
}

export function pickProvider(url: URL): ProviderAdapter | undefined {
  return providers.find((p) => p.matches.some((pattern) => matchPattern(pattern, url)));
}

/** Minimal match-pattern check for https patterns like "https://*.typeform.com/*". */
function matchPattern(pattern: string, url: URL): boolean {
  const m = pattern.match(/^(https?):\/\/([^/]+)(\/.*)$/);
  if (!m) return false;
  const [, scheme, host, path] = m as unknown as [string, string, string, string];
  if (url.protocol !== `${scheme}:`) return false;
  const hostOk = host.startsWith('*.')
    ? url.hostname === host.slice(2) || url.hostname.endsWith(host.slice(1))
    : url.hostname === host;
  const pathRe = new RegExp('^' + path.split('*').map(escapeRe).join('.*') + '$');
  return hostOk && pathRe.test(url.pathname + url.search);
}

function escapeRe(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}
