import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { benchmarkEntrySchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';

/**
 * GET /api/benchmarks
 * Returns all active benchmark entries and household multipliers.
 */
export async function GET(request: NextRequest) {
  try {
    await withAuth(request, ['lender']);

    const [benchmarksSnap, multipliersSnap] = await Promise.all([
      adminDb.collection('benchmarks').where('isActive', '==', true).get(),
      adminDb.collection('householdMultipliers').where('isActive', '==', true).get(),
    ]);

    return NextResponse.json({
      benchmarks: benchmarksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      multipliers: multipliersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * POST /api/benchmarks
 * Lender creates a new benchmark entry.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);

    const body = await request.json();
    const parsed = benchmarkEntrySchema.parse(body);

    const benchmarkId = randomUUID();

    const benchmarkData = {
      benchmarkId,
      categoryName: parsed.categoryName,
      householdType: parsed.householdType,
      fortnightlyAmount: parsed.fortnightlyAmount,
      rangeLow: parsed.rangeLow,
      rangeHigh: parsed.rangeHigh,
      source: parsed.source,
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo ?? null,
      createdBy: auth.uid,
      isActive: true,
      previousVersionId: null,
    };

    await adminDb.collection('benchmarks').doc(benchmarkId).set({
      ...benchmarkData,
      lastUpdated: FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: 'benchmark_created',
      targetId: benchmarkId,
      targetType: 'benchmark',
      outcome: 'success',
      ipAddress: ip,
      changes: { categoryName: parsed.categoryName, fortnightlyAmount: parsed.fortnightlyAmount },
    });

    return NextResponse.json({ benchmarkId, benchmark: benchmarkData }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
