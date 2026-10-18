import { describe, expect, it } from 'vitest';
import { jotform } from '@/providers/jotform';
import { microsoft } from '@/providers/microsoft';
import { cleanQuestion } from '@/providers/read-controls';
import { contentScriptMatches, matchSubmitRequest, pickProvider, providers } from '@/providers/registry';
import { tally } from '@/providers/tally';
import { typeform } from '@/providers/typeform';
import { load } from './fixtures/google';
import {
  JOTFORM_AFTER_CAPTCHA_URL,
  JOTFORM_SUBMIT_URL,
  JOTFORM_URL,
  MS_URL,
  TALLY_URL,
  TYPEFORM_URL,
  jotformCaptcha,
  jotformForm,
  jotformThanks,
  msForm,
  msThanks,
  tallyForm,
  tallyThanks,
  typeformScreen,
} from './fixtures/providers';

const url = (s: string) => new URL(s);
const answersOf = (list: { question: string; value: string }[]) =>
  Object.fromEntries(list.map((a) => [a.question, a.value]));
const SAW = { sawQuestions: true };
const FRESH = { sawQuestions: false };

describe('registry', () => {
  it('picks the right provider for each site', () => {
    expect(pickProvider(url(TALLY_URL))?.id).toBe('tally');
    expect(pickProvider(url(TYPEFORM_URL))?.id).toBe('typeform');
    expect(pickProvider(url('https://acme.typeform.com/to/abc123'))?.id).toBe('typeform');
    expect(pickProvider(url(JOTFORM_URL))?.id).toBe('jotform');
    expect(pickProvider(url(JOTFORM_SUBMIT_URL))?.id).toBe('jotform');
    expect(pickProvider(url(MS_URL))?.id).toBe('microsoft');
    expect(pickProvider(url('https://forms.cloud.microsoft/r/AbCdEf'))?.id).toBe('microsoft');
    expect(pickProvider(url('https://www.typeform.com/templates/'))).toBeUndefined();
  });

  it('has unique ids and only https match patterns', () => {
    expect(new Set(providers.map((p) => p.id)).size).toBe(providers.length);
    expect(contentScriptMatches.every((m) => m.startsWith('https://'))).toBe(true);
  });

  it('maps submit requests to the same form id the page URL gives', () => {
    const cases: [string, string, string][] = [
      ['https://api.tally.so/forms/Vw2e3O/respond', 'tally', tally.formId(url(TALLY_URL))!],
      ['https://api.typeform.com/forms/WDFSox2j/complete-submission', 'typeform', typeform.formId(url(TYPEFORM_URL))!],
      ['https://submit.jotform.com/submit/240421974148053', 'jotform', jotform.formId(url(JOTFORM_URL))!],
      [
        "https://forms.office.com/formapi/api/t1/users/u1/forms('AbC123_xyz')/responses",
        'microsoft',
        microsoft.formId(url(MS_URL))!,
      ],
    ];
    for (const [request, provider, pageFormId] of cases) {
      const m = matchSubmitRequest(request);
      expect(m?.provider.id).toBe(provider);
      expect(m?.formId).toBe(pageFormId);
    }
  });

  it('ignores unrelated requests', () => {
    expect(matchSubmitRequest('https://api.tally.so/forms/Vw2e3O/events')).toBeUndefined();
    expect(matchSubmitRequest('https://api.typeform.com/forms/X/start-submission')).toBeUndefined();
    expect(matchSubmitRequest('https://docs.google.com/forms/d/e/X/formResponse')).toBeUndefined();
  });
});

describe('cleanQuestion', () => {
  it('drops numbering and required markers', () => {
    expect(cleanQuestion(' 3. Your name * ')).toBe('Your name');
    expect(cleanQuestion('1.Rate the course')).toBe('Rate the course');
    expect(cleanQuestion("What's your name?*")).toBe("What's your name?");
    expect(cleanQuestion('Email (required)')).toBe('Email');
  });
});

describe('tally', () => {
  it('reads title, link and answers from the block list', () => {
    const doc = load(tallyForm);
    expect(tally.title(doc)).toBe('Customer Satisfaction Survey');
    expect(tally.formUrl(url(TALLY_URL))).toBe(TALLY_URL);
    expect(answersOf(tally.captureAnswers(doc))).toEqual({
      'How often do you use the product?': '',
      'How satisfied are you?': '',
      'Anything else?': '',
    });
    doc.querySelector<HTMLInputElement>('#choice_b')!.checked = true;
    doc.querySelector<HTMLInputElement>('#star_4')!.checked = true;
    doc.querySelector<HTMLTextAreaElement>('#t1')!.value = 'Love it';
    expect(answersOf(tally.captureAnswers(doc))).toEqual({
      'How often do you use the product?': 'Weekly',
      'How satisfied are you?': '4 stars',
      'Anything else?': 'Love it',
    });
  });

  it('only counts "form gone" as submitted after questions were seen', () => {
    expect(tally.isConfirmation(load(tallyForm), url(TALLY_URL), SAW)).toBe(false);
    expect(tally.isConfirmation(load(tallyThanks), url(TALLY_URL), SAW)).toBe(true);
    expect(tally.isConfirmation(load(tallyThanks), url(TALLY_URL), FRESH)).toBe(false);
    expect(tally.settleMs).toBeGreaterThan(0);
  });
});

describe('typeform', () => {
  it('reads every rendered block, answered or not', () => {
    const doc = load(typeformScreen);
    expect(typeform.title(doc)).toBe('Customer Satisfaction Survey Template');
    doc.querySelector('[role="radio"][value="4"]')!.setAttribute('aria-checked', 'true');
    doc.querySelector<HTMLInputElement>('[data-qa-blockref="b2"] input')!.value = 'Aadi';
    expect(answersOf(typeform.captureAnswers(doc))).toEqual({
      'How satisfied are you with your overall experience?': '4',
      "What's your name?": 'Aadi',
    });
  });

  it('detects the end of the form', () => {
    expect(typeform.isConfirmation(load(typeformScreen), url(TYPEFORM_URL), SAW)).toBe(false);
    const ending = load('<html><body><div data-qa="thankyou-screen-visible">Thanks!</div></body></html>');
    expect(typeform.isConfirmation(ending, url(TYPEFORM_URL), FRESH)).toBe(true);
    const blank = load('<html><body><div data-qa="renderer"></div></body></html>');
    expect(typeform.isConfirmation(blank, url(TYPEFORM_URL), SAW)).toBe(true);
    expect(typeform.isConfirmation(blank, url(TYPEFORM_URL), FRESH)).toBe(false); // welcome screen
  });
});

describe('jotform', () => {
  it('reads classic form fields, skipping headers and buttons', () => {
    const doc = load(jotformForm);
    expect(jotform.title(doc)).toBe('Simple Registration Form');
    doc.querySelector<HTMLInputElement>('#first_3')!.value = 'Aadi';
    doc.querySelector<HTMLInputElement>('#last_3')!.value = 'V';
    doc.querySelector<HTMLInputElement>('#input_4')!.value = 'aadi@example.com';
    doc.querySelector<HTMLInputElement>('#input_6_1')!.checked = true;
    doc.querySelector<HTMLInputElement>('#input_7_0')!.checked = true;
    doc.querySelector<HTMLInputElement>('#input_7_1')!.checked = true;
    // Choice questions title themselves with span.form-label, not label.form-label.
    expect(answersOf(jotform.captureAnswers(doc))).toEqual({
      Name: 'Aadi V',
      Email: 'aadi@example.com',
      Gender: 'Female',
      'Dietary needs': 'Vegan, No nuts',
    });
  });

  it('treats the submit.jotform.com thank-you page as the confirmation', () => {
    expect(jotform.isConfirmation(load(jotformForm), url(JOTFORM_URL), SAW)).toBe(false);
    expect(jotform.isConfirmation(load(jotformThanks), url(JOTFORM_SUBMIT_URL), FRESH)).toBe(true);
    // Server-side validation error re-renders the form on the submit URL.
    expect(jotform.isConfirmation(load(jotformForm), url(JOTFORM_SUBMIT_URL), FRESH)).toBe(false);
    // The captcha check is served on the submit URL too, before the response is accepted.
    expect(jotform.isConfirmation(load(jotformCaptcha), url(JOTFORM_SUBMIT_URL), FRESH)).toBe(false);
    expect(jotform.captureAnswers(load(jotformCaptcha))).toEqual([]);
    expect(jotform.isConfirmation(load(jotformThanks), url(JOTFORM_AFTER_CAPTCHA_URL), FRESH)).toBe(true);
    expect(jotform.formId(url(JOTFORM_AFTER_CAPTCHA_URL))).toBe(jotform.formId(url(JOTFORM_URL)));
    expect(jotform.formUrl(url(JOTFORM_AFTER_CAPTCHA_URL))).toBe(JOTFORM_URL);
    // Jotform's own pages on that host are not a confirmation.
    expect(jotform.isConfirmation(load(jotformThanks), url('https://submit.jotform.com/server.php'), FRESH)).toBe(false);
    expect(jotform.formUrl(url(JOTFORM_SUBMIT_URL))).toBe(JOTFORM_URL);
  });
});

describe('submit request signal', () => {
  it('counts only redirects for Jotform, whose submit URL also serves the captcha check', () => {
    expect(jotform.submitRequest?.redirectOnly).toBe(true);
    expect(providers.filter((p) => p.submitRequest?.redirectOnly).map((p) => p.id)).toEqual(['jotform']);
  });
});

describe('microsoft (unverified markup)', () => {
  it('reads title, questions and answers', () => {
    const doc = load(msForm);
    expect(microsoft.title(doc)).toBe('Course Feedback, Sem 5');
    doc.querySelector<HTMLInputElement>('[data-automation-id="textInput"]')!.value = 'Aadi';
    doc.querySelector<HTMLInputElement>('#r2')!.checked = true;
    expect(answersOf(microsoft.captureAnswers(doc))).toEqual({ 'Your name': 'Aadi', 'Rate the course': 'Great' });
  });

  it('detects the thank-you panel and skips owner pages', () => {
    expect(microsoft.isConfirmation(load(msForm), url(MS_URL), SAW)).toBe(false);
    expect(microsoft.isConfirmation(load(msThanks), url(MS_URL), FRESH)).toBe(true);
    expect(microsoft.formId(url('https://forms.office.com/Pages/DesignPageV2.aspx?id=AbC'))).toBeNull();
    expect(microsoft.formId(url('https://forms.cloud.microsoft/r/AbCdEf'))).toBe('AbCdEf');
  });
});
