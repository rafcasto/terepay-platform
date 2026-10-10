import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { getDriveClient, downloadDriveFile, inlineContentDisposition } from '@/lib/gdrive/client';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; reportId: string }> };

/**
 * GET /api/applications/[id]/reports/[reportId]
 * Streams a lender-uploaded provider report (DataZoo / Centrix) from Google
 * Drive back to the lender. The report lives on the borrower's customer
 * profile (users/{customerId}/lenderReports).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id, reportId } = await params;

    if (!(await checkRateLimit(defaultLimiter, `reports-view:${auth.uid}`))) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests — please slow down');
    }

    const appSnap = await adminDb.collection('loanApplications').doc(id).get();
    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const customerId = appSnap.data()!.applicantId as string | undefined;
    if (!customerId) throw new AppError('NOT_FOUND', 404, 'Report not found');

    const repSnap = await adminDb
      .collection('users')
      .doc(customerId)
      .collection('lenderReports')
      .doc(reportId)
      .get();
    if (!repSnap.exists) throw new AppError('NOT_FOUND', 404, 'Report not found');

    const rep = repSnap.data()!;
    const driveFileId = rep.driveFileId as string | undefined;
    if (!driveFileId) throw new AppError('NOT_FOUND', 404, 'Report file is missing');
    const fileName = (rep.fileName as string) ?? 'report';

    const drive = getDriveClient();
    const { buffer: data, mimeType } = await downloadDriveFile(drive, driveFileId);

    await auditLog({
      userId: auth.uid,
      action: 'lender_report_viewed',
      targetId: customerId,
      targetType: 'customer_profile',
      outcome: 'success',
      ipAddress: ip,
      changes: { reportId, applicationId: id },
    });

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': inlineContentDisposition(fileName),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    if ((err as { code?: number })?.code === 404) {
      return errorResponse(new AppError('NOT_FOUND', 404, 'Report is no longer available in storage'));
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[applications/reports] view failed:', detail);
    // Surface the underlying reason outside production to aid debugging.
    if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'production') {
      return errorResponse(new AppError('DOWNLOAD_FAILED', 502, `Download failed: ${detail}`));
    }
    return internalError();
  }
}
