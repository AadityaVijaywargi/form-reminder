// Runs apps-script/Code.gs in a Node VM against in-memory fakes of the Apps Script services.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

interface Mail {
  to: string;
  subject: string;
  htmlBody?: string;
  body?: string;
}

const source = readFileSync(resolve(__dirname, '../apps-script/Code.gs'), 'utf8');

function makeRelay() {
  const props = new Map<string, string>();
  const cache = new Map<string, string>();
  const sent: Mail[] = [];
  let quota = 100;

  const context = createContext({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => props.set(k, v),
        deleteProperty: (k: string) => props.delete(k),
        getKeys: () => [...props.keys()],
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => cache.set(k, v),
        remove: (k: string) => cache.delete(k),
      }),
    },
    MailApp: {
      sendEmail: (m: Mail) => {
        quota--;
        sent.push(m);
      },
      getRemainingDailyQuota: () => quota,
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      getUuid: () => randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_alg: string, s: string) =>
        [...createHash('sha256').update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: (bytes: number[]) =>
        Buffer.from(bytes.map((b) => b & 0xff)).toString('base64url'),
      formatDate: (d: Date) => d.toISOString().slice(0, 10),
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Kolkata',
      getEffectiveUser: () => ({ getEmail: () => 'owner@gmail.com' }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (content: string) => ({ content, setMimeType() { return this; } }),
    },
  });
  runInContext(source, context);

  const post = (body: unknown) => {
    const out = context.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
    return JSON.parse(out.content);
  };

  async function verify(email = 'user@example.com'): Promise<string> {
    expect(post({ action: 'verify_start', email })).toEqual({ ok: true });
    const code = sent.at(-1)!.subject.match(/(\d{6})$/)![1];
    const res = post({ action: 'verify_confirm', email, code });
    expect(res.ok).toBe(true);
    return res.token;
  }

  return { post, verify, sent, props, cache, setQuota: (q: number) => (quota = q) };
}

const receipt = (token: string, extra: object = {}) => ({
  action: 'receipt',
  token,
  provider: 'google',
  providerName: 'Google Forms',
  title: 'Hackathon Registration 2026',
  url: 'https://docs.google.com/forms/d/e/X/viewform',
  submittedAt: '2026-10-18T05:12:00.000Z',
  submittedAtText: 'Sunday, 18 October 2026 at 10:42 am IST',
  answers: [{ question: 'Team name', value: 'Null Pointers' }],
  ...extra,
});

describe('apps script relay', () => {
  let relay: ReturnType<typeof makeRelay>;
  beforeEach(() => {
    relay = makeRelay();
  });

  it('verifies an email, then sends receipts only to that address', async () => {
    const token = await relay.verify('User@Example.com ');
    expect(relay.sent[0]!.to).toBe('user@example.com');

    expect(relay.post(receipt(token))).toMatchObject({ ok: true });
    const mail = relay.sent.at(-1)!;
    expect(mail.to).toBe('user@example.com');
    expect(mail.subject).toBe('✅ Submitted: Hackathon Registration 2026');
    expect(mail.htmlBody).toContain('Sunday, 18 October 2026 at 10:42 am IST');
    expect(mail.htmlBody).toContain('Null Pointers');
    expect(mail.htmlBody).toContain('href="https://docs.google.com/forms/d/e/X/viewform"');
  });

  it('stores only a hash of the token', async () => {
    const token = await relay.verify();
    const keys = [...relay.props.keys()];
    expect(keys.some((k) => k.includes(token))).toBe(false);
    expect([...relay.props.values()]).toContain('user@example.com');
  });

  it('rejects wrong codes and unknown tokens', async () => {
    relay.post({ action: 'verify_start', email: 'a@b.co' });
    expect(relay.post({ action: 'verify_confirm', email: 'a@b.co', code: '000000x' }).error).toMatch(/bad_code/);
    expect(relay.post(receipt('nope'))).toEqual({ ok: false, error: 'unknown_token' });
    expect(relay.post({ action: 'verify_start', email: 'not-an-email' })).toEqual({ ok: false, error: 'bad_email' });
  });

  it('limits code requests and guesses', () => {
    for (let i = 0; i < 3; i++) expect(relay.post({ action: 'verify_start', email: 'a@b.co' }).ok).toBe(true);
    expect(relay.post({ action: 'verify_start', email: 'a@b.co' })).toEqual({ ok: false, error: 'rate_limited' });
    for (let i = 0; i < 5; i++) relay.post({ action: 'verify_confirm', email: 'a@b.co', code: '111111' });
    expect(relay.post({ action: 'verify_confirm', email: 'a@b.co', code: '111111' }).error).toBe('rate_limited');
  });

  it('caps receipts per token and reports busy when the daily quota is gone', async () => {
    const token = await relay.verify();
    for (let i = 0; i < 20; i++) expect(relay.post(receipt(token)).ok).toBe(true);
    expect(relay.post(receipt(token))).toEqual({ ok: false, error: 'rate_limited' });

    const other = await makeRelayWithToken();
    other.relay.setQuota(0);
    expect(other.relay.post(receipt(other.token))).toEqual({ ok: false, error: 'busy' });
  });

  it('escapes titles and answers and drops non-https links', async () => {
    const token = await relay.verify();
    relay.post(
      receipt(token, {
        title: '<b>hi</b>',
        url: 'javascript:alert(1)',
        answers: [{ question: '<img src=x onerror=alert(1)>', value: '"><script>x</script>' }],
      }),
    );
    const html = relay.sent.at(-1)!.htmlBody!;
    expect(html).not.toMatch(/<b>hi<\/b>|<img|<script/);
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(html).not.toContain('javascript:');
  });

  it('says answers are unavailable for an empty list and omits the section when answers are off', async () => {
    const token = await relay.verify();
    relay.post(receipt(token, { answers: [] }));
    expect(relay.sent.at(-1)!.htmlBody).toContain('Answers unavailable');
    relay.post(receipt(token, { answers: null, test: true }));
    const mail = relay.sent.at(-1)!;
    expect(mail.htmlBody).not.toContain('Your answers');
    expect(mail.subject.startsWith('[Test] ')).toBe(true);
  });

  it('deletes a token on request', async () => {
    const token = await relay.verify();
    expect(relay.post({ action: 'delete', token })).toEqual({ ok: true });
    expect(relay.post(receipt(token))).toEqual({ ok: false, error: 'unknown_token' });
  });

  it('rejects malformed requests', () => {
    expect(relay.post('{not json')).toEqual({ ok: false, error: 'bad_json' });
    expect(relay.post({ action: 'launch_rockets' })).toEqual({ ok: false, error: 'unknown_action' });
  });
});

async function makeRelayWithToken() {
  const relay = makeRelay();
  return { relay, token: await relay.verify() };
}
