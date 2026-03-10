import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';

export const dynamic = 'force-dynamic';

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

function getComponent(components: AddressComponent[], ...types: string[]): string {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match.longText;
  }
  return '';
}

/**
 * GET /api/places/details?placeId=<id>&sessiontoken=<uuid>
 *
 * Server-side proxy for Google Place Details (New API v1).
 * Returns a structured address object parsed from Google's addressComponents.
 * Using a session token that was started in /api/places/autocomplete counts the
 * full Autocomplete + Details session as a single billable event.
 *
 * The browser's Referer header is forwarded so that HTTP-referrer-restricted
 * API keys are satisfied.
 */
export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const { searchParams } = new URL(request.url);
    const placeId = (searchParams.get('placeId') ?? '').slice(0, 300);
    const sessiontoken = (searchParams.get('sessiontoken') ?? '').slice(0, 200);

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
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

    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessiontoken) url.searchParams.set('sessionToken', sessiontoken);

    const res = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'formattedAddress,addressComponents',
        'Referer': referer,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ address: null });
    }

    const data = await res.json();
    const components: AddressComponent[] = data.addressComponents ?? [];

    const streetNumber = getComponent(components, 'street_number');
    const route = getComponent(components, 'route');
    const suburb = getComponent(components, 'sublocality_level_1', 'sublocality');
    const city = getComponent(components, 'locality', 'postal_town');
    const postCode = getComponent(components, 'postal_code');

    return NextResponse.json({
      address: {
        street: [streetNumber, route].filter(Boolean).join(' '),
        suburb,
        city,
        postCode,
        country: 'New Zealand',
        formatted: data.formattedAddress ?? '',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
