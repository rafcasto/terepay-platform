import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth, type AuthResult } from '@/lib/auth/middleware';
import { creditAssessmentRequestSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { buildCreditAssessmentPayload } from '@/lib/assessment/inputs';
import {
  enqueueAssessmentJob,
  getAssessmentJob,
  getAssessmentQueueLength,
  isAssessmentQueueConfigured,
  isAssessmentWorkerOnline,
} from '@/lib/assessment/queue';
import { createAssessmentRecord, finaliseAssessmentRecord, getAssessmentRecord } from '@/lib/assessment/persist';
import type { LoanApplication } from '@/types/application';
import type { CreditAssessmentJob, CreditAssessmentRecord } from '@/types/credit-assessment';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/** Same window the affordability wizard itself is available in. */
const ASSESSABLE_STATUSES = new Set(['under_assessment', 'waiting_for_docs', 'credit_check']);

async function loadAssignedApplication(id: string, auth: AuthResult): Promise<LoanApplication> {
  const snap = await adminDb.collection('loanApplications').doc(id).get();
  if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
  const app = { ...(snap.data() as LoanApplication), applicationId: snap.id };
  if (app.assignedLenderId !== auth.uid) {
    throw new AppError('FORBIDDEN', 403, 'Only the assigned lender can run the AI assessment');
  }
  return app;
}

/** A Firestore record presented in the same shape as a live Redis job (for the client). */
function recordToJob(record: CreditAssessmentRecord): CreditAssessmentJob {
  return {
    id: record.assessmentId,
    type: 'assess_application',
    applicationId: record.applicationId,
    status: record.status,
    payload: record.inputs,
    createdAt: record.requestedAt,
    createdBy: record.requestedByName,
    startedAt: record.startedAt,
    endedAt: record.completedAt,
    worker: record.worker,
    log: record.log,
    result: record.result ?? null,
    error: record.error,
  };
}

/**
 * POST /api/applications/[id]/credit-assessment
 * Lender runs the AI credit assessment from the Results & Decision step. The
 * server assembles every input the agent needs (application, verified figures,
 * loan history, statement documents); if any is missing the request fails with
 * MISSING_INPUTS and nothing is queued.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  let uid = 'unknown';
  let applicationId = '';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const auth = await withAuth(request, ['lender']);
    uid = auth.uid;
    const { id } = await params;
    applicationId = id;

    const app = await loadAssignedApplication(id, auth);
    if (!ASSESSABLE_STATUSES.has(app.status)) {
      throw new AppError('BAD_REQUEST', 400, `Cannot run an assessment while status is: ${app.status}`);
    }

    const body = await request.json();
    const input = creditAssessmentRequestSchema.parse(body);

    if (!isAssessmentQueueConfigured()) {
      throw new AppError('CONFIG_ERROR', 503, 'The assessment queue is not configured (Upstash Redis)');
    }

    // One assessment at a time per application — the Pi runs one model at a time.
    const inFlight = app.creditAssessment;
    if (inFlight && (inFlight.status === 'queued' || inFlight.status === 'running')) {
      const live = await getAssessmentJob(inFlight.assessmentId);
      if (live && (live.status === 'queued' || live.status === 'running')) {
        throw new AppError('CONFLICT', 409, 'An AI assessment is already running for this application', { jobId: live.id });
      }
    }

    const payload = await buildCreditAssessmentPayload(app, input); // throws MISSING_INPUTS (422)

    if (!(await isAssessmentWorkerOnline())) {
      throw new AppError('WORKER_OFFLINE', 503, 'The assessment worker is offline — start it on the assessment machine and try again');
    }

    const lenderDoc = await adminDb.collection('users').doc(auth.uid).get();
    const lenderData = lenderDoc.data();
    const lenderName = lenderData ? `${lenderData.firstName ?? ''} ${lenderData.lastName ?? ''}`.trim() || auth.email : auth.email;

    const job = await enqueueAssessmentJob({ applicationId: id, payload, createdBy: auth.email });
    await createAssessmentRecord(job, { uid: auth.uid, name: lenderName });
    const queueLength = await getAssessmentQueueLength();

    await auditLog({
      userId: auth.uid,
      action: 'credit_assessment_requested',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      changes: {
        assessmentId: job.id,
        assessedAmount: payload.application.loan_amount,
        documents: payload.documents.map((d) => ({ driveId: d.driveId, kind: d.kind })),
        loanHistoryCount: payload.application.loan_history_count,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { job, queueLength } }, { status: 202 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) {
      if (err.code === 'MISSING_INPUTS') {
        await auditLog({
          userId: uid,
          action: 'credit_assessment_requested',
          targetId: applicationId,
          targetType: 'application',
          outcome: 'failure',
          errorDetail: err.message,
          ipAddress: ip,
        });
      }
      return errorResponse(err);
    }
    console.error('[credit-assessment POST]', err);
    await auditLog({
      userId: uid,
      action: 'credit_assessment_requested',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}

/**
 * GET /api/applications/[id]/credit-assessment[?jobId=…]
 * With `jobId`: poll a job; the first poll that sees a terminal state copies
 * it into Firestore. Without: the latest assessment for the application.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, ['lender']);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const { id } = await params;
    const app = await loadAssignedApplication(id, auth);
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (jobId) {
      const record = await getAssessmentRecord(jobId);
      if (!record || record.applicationId !== id) throw new AppError('NOT_FOUND', 404, 'Assessment not found');
      if (record.status === 'done' || record.status === 'failed' || record.status === 'cancelled') {
        return NextResponse.json({ data: recordToJob(record) });
      }
      const job = isAssessmentQueueConfigured() ? await getAssessmentJob(jobId) : null;
      if (!job || job.applicationId !== id) {
        // Redis entry expired before anyone collected the result.
        const lost: CreditAssessmentJob = { ...recordToJob(record), status: 'failed', error: 'The assessment result was not collected in time — run it again', endedAt: Date.now() };
        await finaliseAssessmentRecord(lost);
        return NextResponse.json({ data: lost });
      }
      if (job.status !== 'queued' && job.status !== 'running') {
        await finaliseAssessmentRecord(job);
      }
      return NextResponse.json({ data: job });
    }

    const latestId = app.creditAssessment?.assessmentId;
    if (!latestId) return NextResponse.json({ data: null });
    const record = await getAssessmentRecord(latestId);
    if (!record) return NextResponse.json({ data: null });
    if ((record.status === 'queued' || record.status === 'running') && isAssessmentQueueConfigured()) {
      const job = await getAssessmentJob(latestId);
      if (job && job.applicationId === id) {
        if (job.status !== 'queued' && job.status !== 'running') await finaliseAssessmentRecord(job);
        return NextResponse.json({ data: job });
      }
    }
    return NextResponse.json({ data: recordToJob(record) });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[credit-assessment GET]', err);
    return internalError();
  }
}
