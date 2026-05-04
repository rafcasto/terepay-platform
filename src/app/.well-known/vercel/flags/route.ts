import { getProviderData } from '@vercel/flags/next';
import { verifyAccess } from '@vercel/flags';
import { NextRequest, NextResponse } from 'next/server';
import {
  newApplicantDashboard,
  paymentTrackingV2,
  autoUnderwriting,
  disableSmsOtp,
} from '../../../../lib/flags/flags';

export async function GET(request: NextRequest) {
  const access = await verifyAccess(request.headers.get('Authorization'));
  if (!access) {
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
