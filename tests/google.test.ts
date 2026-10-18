import { describe, expect, it } from 'vitest';
import { google } from '@/providers/google';
import { pickProvider } from '@/providers/registry';
import {
  RESPONSE_URL,
  VIEWFORM_URL,
  confirmation,
  confirmationNoLink,
  load,
  midForm,
  viewform,
} from './fixtures/google';

const url = (s: string) => new URL(s);
const CTX = { sawQuestions: false };

function fill(doc: Document) {
  doc.querySelector<HTMLInputElement>('#q-team input')!.value = 'Null Pointers';
  doc.querySelector('#q-track [data-value="AI / ML"]')!.setAttribute('aria-checked', 'true');
  doc.querySelectorAll('#q-diet [role="checkbox"]').forEach((el) => el.setAttribute('aria-checked', 'true'));
  doc.querySelector('#q-size [data-value=""]')!.setAttribute('aria-selected', 'false');
  doc.querySelector('#q-size [data-value="M"]')!.setAttribute('aria-selected', 'true');
  doc.querySelector('#q-grid [aria-label="Keynote"] [data-value="Great"]')!.setAttribute('aria-checked', 'true');
  doc.querySelector('#q-grid [aria-label="Workshops"] [data-value="Good"]')!.setAttribute('aria-checked', 'true');
  doc.querySelector<HTMLInputElement>('#q-time [aria-label="Hour"]')!.value = '9';
  doc.querySelector<HTMLInputElement>('#q-time [aria-label="Minute"]')!.value = '5';
  doc.querySelector<HTMLInputElement>('#q-pass input')!.value = 'hunter2';
}

describe('google adapter', () => {
  it('is picked for docs.google.com/forms URLs only', () => {
    expect(pickProvider(url(VIEWFORM_URL))?.id).toBe('google');
    expect(pickProvider(url('https://docs.google.com/document/d/abc/edit'))).toBeUndefined();
    expect(pickProvider(url('https://example.com/forms/x'))).toBeUndefined();
  });

  it('extracts the form id from published, editor and account-switch URLs', () => {
    expect(google.formId(url(VIEWFORM_URL))).toBe('1FAIpQLSdTEST123');
    expect(google.formId(url('https://docs.google.com/forms/d/abcDEF_-9/viewform'))).toBe('abcDEF_-9');
    expect(google.formId(url('https://docs.google.com/forms/u/1/d/e/XYZ/formResponse'))).toBe('XYZ');
    expect(google.formId(url('https://docs.google.com/forms/'))).toBeNull();
  });

  it('builds a canonical viewform link', () => {
    expect(google.formUrl(url(RESPONSE_URL))).toBe(VIEWFORM_URL);
    expect(google.formUrl(url(`${VIEWFORM_URL}?usp=sf_link`))).toBe(VIEWFORM_URL);
  });

  it('reads the title from og:title, then the heading, then document.title', () => {
    expect(google.title(load(viewform))).toBe('Hackathon Registration 2026');
    const doc = load('<html><head><title>Club Form - Google Forms</title></head><body></body></html>');
    expect(google.title(doc)).toBe('Club Form');
  });

  it('treats the filling page and the mid-form "Next" page as not submitted', () => {
    expect(google.isConfirmation(load(viewform), url(VIEWFORM_URL), CTX)).toBe(false);
    expect(google.isConfirmation(load(midForm), url(RESPONSE_URL), CTX)).toBe(false);
  });

  it('detects the confirmation page with and without the "submit another" link', () => {
    expect(google.isConfirmation(load(confirmation), url(RESPONSE_URL), CTX)).toBe(true);
    expect(google.isConfirmation(load(confirmationNoLink), url(RESPONSE_URL), CTX)).toBe(true);
    // Same markup on a non-response URL isn't enough without the confirm link.
    expect(google.isConfirmation(load(confirmationNoLink), url(VIEWFORM_URL), CTX)).toBe(false);
  });

  it('lists every visible question, empty ones included', () => {
    const answers = google.captureAnswers(load(viewform));
    expect(answers.map((a) => a.question)).toEqual([
      'Team name',
      'Track',
      'Dietary needs',
      'T-shirt size',
      'Rate the sessions',
      'Arrival time',
      'Portal password',
    ]);
    expect(answers.every((a) => a.value === '')).toBe(true);
  });

  it('reads text, choice, checkbox, dropdown, grid and time answers', () => {
    const doc = load(viewform);
    fill(doc);
    expect(Object.fromEntries(google.captureAnswers(doc).map((a) => [a.question, a.value]))).toEqual({
      'Team name': 'Null Pointers',
      Track: 'AI / ML',
      'Dietary needs': 'Vegetarian, No nuts',
      'T-shirt size': 'M',
      'Rate the sessions': 'Keynote → Great; Workshops → Good',
      'Arrival time': '09:05',
      'Portal password': 'hunter2', // masking happens later, in lib/mask
    });
  });

  it('reads the "Other" option text', () => {
    const doc = load(viewform);
    doc.querySelector('#q-track [data-value="__other_option__"]')!.setAttribute('aria-checked', 'true');
    doc.querySelector<HTMLInputElement>('#q-track [aria-label="Other response"]')!.value = 'Hardware';
    const track = google.captureAnswers(doc).find((a) => a.question === 'Track');
    expect(track?.value).toBe('Other: Hardware');
  });

  it('falls back to the hidden entry inputs for unknown widgets', () => {
    const doc = load(`<html><body><div role="listitem">
      <div role="heading">Mystery</div>
      <input type="hidden" name="entry.1" value="A">
      <input type="hidden" name="entry.1_sentinel" value="">
    </div></body></html>`);
    expect(google.captureAnswers(doc)).toEqual([{ question: 'Mystery', value: 'A' }]);
  });
});
