import { getProviderData } from '@vercel/flags/next';
import { NextResponse } from 'next/server';
import * as flags from '@/lib/flags/flags';

export const runtime = 'edge';

export async function GET() {
  const data = await getProviderData(flags);
  return NextResponse.json(data);
}
