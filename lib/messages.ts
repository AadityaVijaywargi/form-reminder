import type { Answer, ProviderId } from '@/providers/types';

/** Content script → background: answers currently visible on the form (merged into a draft). */
export interface DraftMessage {
  type: 'DRAFT';
  provider: ProviderId;
  formId: string;
  title: string | null;
  /** Canonical form link, so a network-signal receipt can include it. */
  url: string;
  answers: Answer[];
}

/** Content script → background: the confirmation screen is showing. */
export interface SubmittedMessage {
  type: 'FORM_SUBMITTED';
  provider: ProviderId;
  formId: string;
  title: string | null;
  url: string;
  answers: Answer[];
}

/** Options page → background. */
export interface TestReceiptMessage {
  type: 'TEST_RECEIPT';
}
export interface DrainMessage {
  type: 'DRAIN';
}

export type Message = DraftMessage | SubmittedMessage | TestReceiptMessage | DrainMessage;
