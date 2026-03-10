import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/places/autocomplete?input=<query>&sessiontoken=<uuid>
 *
 * Server-side proxy for Google Places Autocomplete (New API v1).
 * The API key is never exposed to the browser — all requests route through here.
 * Restricted to NZ street addresses only.
 *
 * The browser's Referer header is forwarded so that HTTP-referrer-restricted
 * API keys are satisfied. Ensure your Google Cloud Console key allows the
 * domains your app is served from (e.g. localhost:3000, your production domain).
 */
export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const { searchParams } = new URL(request.url);
    const rawInput = searchParams.get('input') ?? '';
    const sessiontoken = (searchParams.get('sessiontoken') ?? '').slice(0, 200);

    // Sanitise: strip non-printable chars, enforce max length
    const input = rawInput.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '').slice(0, 200);

    if (input.length < 3) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new AppError('CONFIG_ERROR', 500, 'Places API not configured');
    }

    // Forward the browser's Referer/Origin so HTTP-referrer-restricted keys work
    const referer =
      request.headers.get('referer') ??
      request.headers.get('origin') ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:3000';

    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'Referer': referer,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['nz'],
        ...(sessiontoken ? { sessionToken: sessiontoken } : {}),
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ predictions: [] });
    }

    const data = await res.json();

    interface PlaceSuggestion {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: {
          mainText?: { text: string };
          secondaryText?: { text: string };
        };
      };
    }

    // Return only the fields the client needs — never forward raw Google response
    const predictions = ((data.suggestions ?? []) as PlaceSuggestion[])
      .filter((s) => s.placePrediction)
      .slice(0, 5)
      .map((s) => ({
        placeId: s.placePrediction!.placeId,
        description:
          s.placePrediction!.text?.text ??
          [
            s.placePrediction!.structuredFormat?.mainText?.text,
            s.placePrediction!.structuredFormat?.secondaryText?.text,
          ]
            .filter(Boolean)
            .join(', '),
      }));

    return NextResponse.json({ predictions });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
