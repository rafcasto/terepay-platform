import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/places/autocomplete?input=<query>&sessiontoken=<uuid>
 *
 * Server-side proxy for Google Places Autocomplete.
 * The API key is never exposed to the browser — all requests route through here.
 * Restricted to NZ street addresses only.
 */
export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const { searchParams } = new URL(request.url);
    const rawInput = searchParams.get('input') ?? '';
    const sessiontoken = searchParams.get('sessiontoken') ?? '';

    // Sanitise: strip non-printable chars, enforce max length
    const input = rawInput.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '').slice(0, 200);

    if (input.length < 3) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new AppError('CONFIG_ERROR', 500, 'Places API not configured');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('types', 'address');
    url.searchParams.set('components', 'country:nz');
    url.searchParams.set('sessiontoken', sessiontoken);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ predictions: [] });
    }

    const data = await res.json();

    // Return only the fields the client needs — never forward raw Google response
    const predictions = ((data.predictions ?? []) as Array<{ place_id: string; description: string }>)
      .slice(0, 5)
      .map((p) => ({ placeId: p.place_id, description: p.description }));

    return NextResponse.json({ predictions });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
