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

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/benchmarks/[id]
 * Lender updates a benchmark entry. Creates a new version, deactivates the old one.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const oldDoc = await adminDb.collection('benchmarks').doc(id).get();
    if (!oldDoc.exists) throw new AppError('NOT_FOUND', 404, 'Benchmark not found');

    const oldData = oldDoc.data()!;
    if (!oldData.isActive) throw new AppError('BAD_REQUEST', 400, 'Cannot update an inactive benchmark');

    const body = await request.json();
    const parsed = benchmarkEntrySchema.parse(body);

    const newBenchmarkId = randomUUID();
    const now = FieldValue.serverTimestamp();

    const batch = adminDb.batch();

    // Deactivate old version, set effectiveTo
    batch.update(adminDb.collection('benchmarks').doc(id), {
      isActive: false,
      effectiveTo: parsed.effectiveFrom, // expires when the new one starts
      lastUpdated: now,
    });

    // Create new version
    batch.set(adminDb.collection('benchmarks').doc(newBenchmarkId), {
      benchmarkId: newBenchmarkId,
      categoryName: parsed.categoryName,
      householdType: parsed.householdType,
      fortnightlyAmount: parsed.fortnightlyAmount,
      rangeLow: parsed.rangeLow,
      rangeHigh: parsed.rangeHigh,
      source: parsed.source,
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo ?? null,
      createdBy: auth.uid,
      lastUpdated: now,
      isActive: true,
      previousVersionId: id,
    });

    await batch.commit();

    await auditLog({
      userId: auth.uid,
      action: 'benchmark_updated',
      targetId: id,
      targetType: 'benchmark',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        previousId: id,
        newId: newBenchmarkId,
        categoryName: parsed.categoryName,
        oldAmount: oldData.fortnightlyAmount,
        newAmount: parsed.fortnightlyAmount,
        changeReason: parsed.changeReason,
      },
    });

    const newBenchmarkData = {
      benchmarkId: newBenchmarkId,
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
      previousVersionId: id,
    };

    return NextResponse.json({ benchmarkId: newBenchmarkId, newBenchmark: newBenchmarkData });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * DELETE /api/benchmarks/[id]
 * Deactivates a benchmark entry (soft delete).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const doc = await adminDb.collection('benchmarks').doc(id).get();
    if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Benchmark not found');

    await adminDb.collection('benchmarks').doc(id).update({
      isActive: false,
      effectiveTo: new Date().toISOString().split('T')[0],
      lastUpdated: FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: 'benchmark_deactivated',
      targetId: id,
      targetType: 'benchmark',
      outcome: 'success',
      ipAddress: ip,
    });

    return NextResponse.json({ status: 'deactivated' });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
