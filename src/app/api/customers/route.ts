import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Valid email is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
    .refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
  phone: z.string().min(7).max(30).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/customers
 * Lender only. Creates an offline customer record with an auto-generated TERE ID.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, ['lender']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const body = await request.json();
    const parsed = createCustomerSchema.parse(body);

    // Generate the next TERE ID via a Firestore transaction on a counter doc
    const counterRef = adminDb.doc('settings/customerIdCounter');
    let customerId = '';

    await adminDb.runTransaction(async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const last: number = counterSnap.exists ? (counterSnap.data()?.lastSequence ?? 0) : 0;
      const next = last + 1;
      customerId = `TERE${String(next).padStart(3, '0')}`;
      tx.set(counterRef, { lastSequence: next }, { merge: true });

      const customerRef = adminDb.collection('offlineCustomers').doc(customerId);
      tx.set(customerRef, {
        customerId,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email.toLowerCase().trim(),
        dateOfBirth: parsed.dateOfBirth,
        ...(parsed.phone ? { phone: parsed.phone } : {}),
        ...(parsed.notes ? { notes: parsed.notes } : {}),
        createdByLenderId: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        status: 'unlinked',
      });
    });

    return NextResponse.json({ data: { customerId } }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 400, err.issues[0]?.message ?? 'Invalid input'));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * GET /api/customers?q=&type=all|online|offline
 * Lender only. Searches both online users (role=applicant) and offline customers.
 * Returns a unified list sorted by name.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, ['lender']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim().toLowerCase();
    const type = searchParams.get('type') ?? 'all';

    // Run both queries in parallel
    const [onlineSnap, offlineSnap] = await Promise.all([
      type !== 'offline'
        ? adminDb.collection('users').where('role', '==', 'applicant').limit(100).get()
        : Promise.resolve(null),
      type !== 'online'
        ? adminDb.collection('offlineCustomers').orderBy('createdAt', 'desc').limit(200).get()
        : Promise.resolve(null),
    ]);

    type CustomerResult = {
      type: 'online' | 'offline';
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      customerId?: string;
      status?: string;
    };

    const results: CustomerResult[] = [];

    if (onlineSnap) {
      for (const doc of onlineSnap.docs) {
        const d = doc.data();
        const fullName = `${d.firstName ?? ''} ${d.lastName ?? ''}`.toLowerCase();
        const email = (d.email ?? '').toLowerCase();
        if (
          q === '' ||
          fullName.includes(q) ||
          email.includes(q) ||
          (d.customerId ?? '').toLowerCase().includes(q)
        ) {
          results.push({
            type: 'online',
            id: doc.id,
            firstName: d.firstName ?? '',
            lastName: d.lastName ?? '',
            email: d.email,
            customerId: d.customerId,
          });
        }
      }
    }

    if (offlineSnap) {
      for (const doc of offlineSnap.docs) {
        const d = doc.data();
        const fullName = `${d.firstName ?? ''} ${d.lastName ?? ''}`.toLowerCase();
        const email = (d.email ?? '').toLowerCase();
        if (
          q === '' ||
          fullName.includes(q) ||
          email.includes(q) ||
          (d.customerId ?? '').toLowerCase().includes(q)
        ) {
          results.push({
            type: 'offline',
            id: doc.id,
            firstName: d.firstName ?? '',
            lastName: d.lastName ?? '',
            email: d.email,
            customerId: d.customerId,
            status: d.status,
          });
        }
      }
    }

    // Sort by firstName then lastName
    results.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ data: results });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
