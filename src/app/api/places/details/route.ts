import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';

export const dynamic = 'force-dynamic';

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

function getComponent(components: AddressComponent[], ...types: string[]): string {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return '';
}

/**
 * GET /api/places/details?placeId=<id>&sessiontoken=<uuid>
 *
 * Server-side proxy for Google Place Details.
 * Returns a structured address object parsed from Google's address_components.
 * Using a session token that was started in /api/places/autocomplete counts the
 * full Autocomplete + Details session as a single billable event.
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

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'address_components,formatted_address');
    url.searchParams.set('sessiontoken', sessiontoken);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ address: null });
    }

    const data = await res.json();
    const components: AddressComponent[] = data.result?.address_components ?? [];

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
        formatted: data.result?.formatted_address ?? '',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
