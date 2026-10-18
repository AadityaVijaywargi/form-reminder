import { browser } from 'wxt/browser';

export interface Settings {
  /** Verified address receipts go to. */
  email?: string;
  /** Install token returned by the relay after verification. */
  token?: string;
  includeAnswers: boolean;
  notify: boolean;
  /** Advanced: point at a self-hosted relay instead of the built-in one. */
  relayUrl?: string;
}

export const DEFAULT_SETTINGS: Settings = { includeAnswers: true, notify: true };

export async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ settings: next });
  return next;
}

/** Built-in relay, baked in at build time from WXT_RELAY_URL (see .env.example). */
export const BUILT_IN_RELAY_URL: string = import.meta.env.WXT_RELAY_URL ?? '';

export function relayUrlOf(settings: Settings): string {
  return settings.relayUrl?.trim() || BUILT_IN_RELAY_URL;
}
