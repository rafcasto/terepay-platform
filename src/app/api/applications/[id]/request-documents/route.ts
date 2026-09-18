import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { requestDocumentsSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { renderEmail } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/resend';
import {
  appBaseUrl,
  escapeHtml,
  logSystemCommunication,
  resolveApplicantContact,
} from '@/lib/loan/communication-log';

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_CLAIM_STATUSES = ['under_assessment', 'waiting_for_docs'];

/**
 * POST /api/applications/[id]/request-documents
 * Lender requests additional documents from the applicant.
 * - Transitions status to waiting_for_docs
 * - Emails the applicant (Resend, `documents_requested` template)
 * - Records the request automatically in the application's communication log
 *
 * The email is best-effort: a provider failure is recorded in the log but
 * does not fail the request — the applicant still sees the ask on their tracker.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const doc = await adminDb.collection('loanApplications').doc(id).get();
    if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const data = doc.data()!;
    if (!ALLOWED_CLAIM_STATUSES.includes(data.status)) {
      throw new AppError('BAD_REQUEST', 400, `Cannot request documents while status is: ${data.status}`);
    }

    const body = await request.json();
    const parsed = requestDocumentsSchema.parse(body);
    const message = parsed.message?.trim() ?? '';

    const now = FieldValue.serverTimestamp();
    await adminDb.collection('loanApplications').doc(id).update({
      status: 'waiting_for_docs',
      documentRequest: {
        requestedAt: now,
        requestedBy: auth.uid,
        requiredDocuments: parsed.requiredDocuments,
        message,
      },
      'timeline.updatedAt': now,
    });

    await auditLog({
      userId: auth.uid,
      action: 'documents_requested',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { requiredDocuments: parsed.requiredDocuments },
    });

    // ── Notify the applicant + auto-log the contact ─────────────────────────
    const pi = (data.personalInfo ?? {}) as { email?: string; firstName?: string };
    const { email, firstName } = await resolveApplicantContact(data.applicantId as string | undefined, pi);
    const reference = (data.referenceNumber as string | undefined) ?? id;
    const trackerUrl = `${appBaseUrl(request.nextUrl.origin)}/applicant/applications/${id}`;

    let emailOutcome: string;
    let emailSent = false;
    if (!email) {
      emailOutcome = 'Email not sent — no email address on file. Applicant will see the request on their tracker.';
    } else {
      try {
        const rendered = await renderEmail('documents_requested', {
          firstName: escapeHtml(firstName || 'there'),
          referenceNumber: escapeHtml(reference),
          documentList: parsed.requiredDocuments.map((d) => `<li>${escapeHtml(d)}</li>`).join(''),
          documentListText: parsed.requiredDocuments.map((d) => `- ${d}`).join('\n'),
          lenderMessageBlock: message
            ? `<p style="margin:0 0 16px;padding:12px 16px;background:#F6F8FB;border-radius:10px;font-size:15px;line-height:1.6;">${escapeHtml(message)}</p>`
            : '',
          lenderMessageText: message ? `\nMessage from your lender:\n${message}\n` : '',
          trackerUrl,
        });
        if (!rendered) {
          emailOutcome = 'Email not sent — no "Documents Requested" template is configured.';
        } else {
          const res = await sendEmail({ to: email, ...rendered });
          emailSent = res.sent;
          emailOutcome = res.sent
            ? 'Email sent.'
            : 'Email skipped — no email provider configured in this environment.';
        }
      } catch (err) {
        console.error('[request-documents] email send failed', id, err instanceof Error ? err.name : 'unknown');
        emailOutcome = 'Email could not be delivered — follow up with the applicant directly.';
      }
    }

    await logSystemCommunication({
      applicationId: id,
      channel: emailSent ? 'email' : 'system',
      event: 'documents_requested',
      summary: `Requested documents: ${parsed.requiredDocuments.join('; ')}.${message ? ` Message to applicant: "${message}"` : ''}`,
      outcome: `${emailOutcome} Application moved to "Waiting for docs".`,
    });

    return NextResponse.json({ status: 'waiting_for_docs', emailSent });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
