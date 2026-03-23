import { getProviderData } from '@vercel/flags/next';
import { NextRequest, NextResponse } from 'next/server';
import {
  newApplicantDashboard,
  paymentTrackingV2,
  autoUnderwriting,
  disableSmsOtp,
} from '../../../../lib/flags/flags';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const access = request.headers.get('Authorization');
  if (access !== `Bearer ${process.env.FLAGS_SECRET}`) {
    return NextResponse.json(null, { status: 401 });
  }
  const data = await getProviderData({
    newApplicantDashboard,
    paymentTrackingV2,
    autoUnderwriting,
    disableSmsOtp,
  });
  return NextResponse.json(data);
}
