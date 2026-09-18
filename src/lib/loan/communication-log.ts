import { randomUUID } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationLogEntry,
} from '@/types/application';

/**
 * Automatic communication-log entries.
 *
 * Workflow actions that contact the applicant (document requests, decisions,
 * document rejections) record themselves here so the lender's Communication
 * tab is a complete record without anyone having to type it in. Entries are
 * marked `source: 'system'` and are visually distinct from lender-logged ones.
 *
 * `logSystemCommunication` never throws — a failed log line must not break
 * the action that triggered it.
 */

export const SYSTEM_ACTOR_ID = 'system';
export const SYSTEM_ACTOR_NAME = 'TerePay (automatic)';

export type SystemCommunicationInput = {
  applicationId: string;
  channel: CommunicationChannel;
  /** Defaults to `outbound` — the platform contacted the applicant. */
  direction?: CommunicationDirection;
  /** Workflow event name, e.g. `documents_requested`, `application_approved`. */
  event: string;
  summary: string;
  outcome?: string;
};

export async function logSystemCommunication(input: SystemCommunicationInput): Promise<void> {
  try {
    const entry: CommunicationLogEntry = {
      entryId: randomUUID(),
      channel: input.channel,
      direction: input.direction ?? 'outbound',
      source: 'system',
      event: input.event,
      summary: input.summary,
      ...(input.outcome ? { outcome: input.outcome } : {}),
      occurredAt: Timestamp.now(),
      loggedBy: SYSTEM_ACTOR_ID,
      loggedByName: SYSTEM_ACTOR_NAME,
      createdAt: Timestamp.now(),
    };
    await adminDb.collection('loanApplications').doc(input.applicationId).update({
      communicationLog: FieldValue.arrayUnion(entry),
    });
  } catch (err) {
    console.error(
      '[communication-log] failed to record system entry',
      input.event,
      input.applicationId,
      err instanceof Error ? err.name : 'unknown',
    );
  }
}

/**
 * Resolve where to email the applicant. The user record is the source of
 * truth (plaintext top-level `email` / `firstName`); the application's
 * declared personal info is the fallback for lender-created customers.
 */
export async function resolveApplicantContact(
  applicantId: string | undefined,
  fallback: { email?: string; firstName?: string } = {},
): Promise<{ email: string; firstName: string }> {
  let email = '';
  let firstName = '';
  if (applicantId) {
    try {
      const snap = await adminDb.collection('users').doc(applicantId).get();
      const u = snap.data() as { email?: string; firstName?: string } | undefined;
      email = u?.email ?? '';
      firstName = u?.firstName ?? '';
    } catch {
      // fall through to the application's declared details
    }
  }
  return {
    email: email || fallback.email || '',
    firstName: firstName || fallback.firstName || '',
  };
}

/**
 * Escape text for safe interpolation into an HTML email body. Only `& < >`
 * are escaped — the same merge values feed the plain-text body, so quotes
 * and apostrophes (common in names) must stay readable there.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Base URL for links in emails — configured origin first, request origin as fallback. */
export function appBaseUrl(requestOrigin: string): string {
  return (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || requestOrigin).replace(/\/$/, '');
}
