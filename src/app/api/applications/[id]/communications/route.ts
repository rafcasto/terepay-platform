import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { logCommunicationSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';
import type { CommunicationLogEntry } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/communications
 * Lender logs a call, message or email exchanged with the applicant.
 * Entries are appended to `loanApplications.communicationLog[]` and are
 * lender-internal (never returned to the applicant).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    if (!(await checkRateLimit(defaultLimiter, `comm-log:${auth.uid}`))) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests — please slow down');
    }

    const appRef = adminDb.collection('loanApplications').doc(id);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const body = await request.json();
    const parsed = logCommunicationSchema.parse(body);

    const occurred = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
    if (Number.isNaN(occurred.getTime())) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid contact date');
    }
    if (occurred.getTime() > Date.now() + 5 * 60_000) {
      throw new AppError('VALIDATION_ERROR', 422, 'Contact date cannot be in the future');
    }

    const lenderSnap = await adminDb.collection('users').doc(auth.uid).get();
    const ld = lenderSnap.data();
    const loggedByName = ld
      ? `${ld.firstName ?? ''} ${ld.lastName ?? ''}`.trim() || auth.email
      : auth.email;

    // arrayUnion can't hold serverTimestamp(); use a concrete Timestamp.
    const entry: CommunicationLogEntry = {
      entryId: randomUUID(),
      channel: parsed.channel,
      direction: parsed.direction,
      summary: parsed.summary.trim(),
      ...(parsed.outcome?.trim() ? { outcome: parsed.outcome.trim() } : {}),
      occurredAt: Timestamp.fromDate(occurred),
      loggedBy: auth.uid,
      loggedByName,
      createdAt: Timestamp.now(),
    };

    await appRef.update({
      communicationLog: FieldValue.arrayUnion(entry),
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    // No summary text in the audit trail — it may contain applicant details.
    await auditLog({
      userId: auth.uid,
      action: 'communication_logged',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { entryId: entry.entryId, channel: entry.channel, direction: entry.direction },
    });

    return NextResponse.json({ status: 'ok', entryId: entry.entryId });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
