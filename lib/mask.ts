import type { Answer } from '@/providers/types';

export const MASK = '••••';

const SENSITIVE_QUESTION =
  /pass(word|code|phrase)|\bpin\b|\botp\b|one[- ]time (code|password)|verification code|\bcvv\b|\bcvc\b|security code|(credit|debit|bank) card|card number|account number|\bifsc\b|aadhaar|aadhar|\bpan( card| number)?\b|\bssn\b|social security|passport number/i;

/** Hide answers that look like secrets or financial/government identifiers. */
export function maskAnswers(answers: Answer[]): Answer[] {
  return answers.map((a) => (isSensitive(a) ? { ...a, value: MASK } : a));
}

function isSensitive({ question, value }: Answer): boolean {
  if (!value) return false;
  if (SENSITIVE_QUESTION.test(question)) return true;
  return looksLikeCardNumber(value);
}

function looksLikeCardNumber(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
