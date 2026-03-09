import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { addNoteSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/notes
 * Lender adds an internal note to an application.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const doc = await adminDb.collection('loanApplications').doc(id).get();
    if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const body = await request.json();
    const parsed = addNoteSchema.parse(body);

    // Fetch lender display name
    const lenderDoc = await adminDb.collection('users').doc(auth.uid).get();
    const lenderData = lenderDoc.data();
    const lenderName = lenderData
      ? `${lenderData.firstName ?? ''} ${lenderData.lastName ?? ''}`.trim()
      : auth.email;

    const note = {
      noteId: randomUUID(),
      lenderId: auth.uid,
      lenderName,
      text: parsed.text,
      createdAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection('loanApplications').doc(id).update({
      internalNotes: FieldValue.arrayUnion(note),
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: 'note_added',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
    });

    return NextResponse.json({ status: 'ok', noteId: note.noteId });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
