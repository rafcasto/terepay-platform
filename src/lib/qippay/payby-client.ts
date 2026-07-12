import { getMode } from './setpay-client';
import { qippayFetch } from './http';
import type { EarlyRepaymentStatus } from '@/types/application';

// Qippay PayBy — Hosted (v1.0, rev 9 — July 2025). A one-off open-banking
// payment: we POST /v1/payment_initiation to create a payment and receive a
// Hosted Payment Page `url`, redirect the customer there to approve at their
// bank, then GET /v1/payment_status/{id} to confirm. Unlike SetPay this is a
// single non-recurring payment — used here for voluntary early loan payoff.
//
// Spec: "Qippay API - PayBy Hosted 2025-07 rev9".

export type PayByInitiateInput = {
  beneficiaryId: string;
  amountCents: number;
  successUrl: string;
  failureUrl: string;
  customerIp: string;
  customerUserAgent: string;
  merchantCustomerIdentification: string;
  statementReference?: string;
  statementParticulars?: string;
  statementCode?: string;
  /** ISO 8601 UTC (…Z). Defaults to 1 day from initiation if omitted. */
  expiresAt?: string;
  metadata?: Record<string, string>;
};

export type PayByPayment = {
  id: string; // pmU_...
  hostedUrl: string;
  status: string; // upstream raw status string
  expiresAt?: string;
};

type PaymentInitiationResponse = {
  id: string;
  url: string;
  status: string;
  expires_at?: string;
  success_url?: string;
  failure_url?: string;
};

type PaymentStatusResponse = {
  id: string;
  status: string;
  expires_at?: string;
  url?: string;
};

// Qippay-permitted statement chars: alphanumeric, space, -, ', ?; max 12 chars.
function sanitiseStatementField(input: string, fallback: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9 \-'?]/g, '').trim().slice(0, 12);
  return cleaned || fallback.slice(0, 12);
}

function stubHostedUrl(successUrl: string): string {
  const u = new URL(successUrl);
  u.searchParams.set('stub', 'success');
  return u.toString();
}

/**
 * Map the raw PayBy status string onto our EarlyRepaymentStatus vocabulary.
 * PayBy statuses (rev 9): awaiting_redirect, pending, expired…, success.
 * There is deliberately no "failure" status — a customer may retry — so we only
 * ever move to a terminal state on `success` or `expired`.
 */
export function normalisePayByStatus(raw: string): EarlyRepaymentStatus {
  const s = raw.toLowerCase();
  if (s === 'success' || s === 'paid' || s === 'completed') return 'paid';
  if (s.startsWith('expired')) return 'expired';
  if (s === 'cancelled' || s === 'canceled' || s === 'revoked') return 'cancelled';
  if (s === 'failed' || s === 'declined') return 'failed';
  if (s === 'awaiting_redirect') return 'initiated';
  return 'pending';
}

export async function initiatePayment(input: PayByInitiateInput): Promise<PayByPayment> {
  if (getMode() === 'stub') {
    const ts = Date.now();
    return {
      id: `stub_payby_${input.merchantCustomerIdentification}_${ts}`,
      hostedUrl: stubHostedUrl(input.successUrl),
      status: 'awaiting_redirect',
      expiresAt: new Date(ts + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const body: Record<string, unknown> = {
    beneficiary_id: input.beneficiaryId,
    success_url: input.successUrl,
    failure_url: input.failureUrl,
    amount: { currency: 'NZD', value: input.amountCents },
    customer_ip_address: input.customerIp,
    customer_user_agent: input.customerUserAgent,
    merchant_customer_identification: input.merchantCustomerIdentification,
    statement_reference: sanitiseStatementField(input.statementReference ?? '', 'Payoff'),
    statement_particulars: sanitiseStatementField(input.statementParticulars ?? '', 'TerePay'),
    statement_code: sanitiseStatementField(input.statementCode ?? '', 'PAYOFF'),
  };
  if (input.expiresAt) body.expires_at = input.expiresAt;
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    body.metadata = input.metadata;
  }

  const data = await qippayFetch<PaymentInitiationResponse>('/v1/payment_initiation', {
    method: 'POST',
    body,
  });

  return {
    id: data.id,
    hostedUrl: data.url,
    status: data.status,
    expiresAt: data.expires_at,
  };
}

export type GetPayByStatusOptions = {
  stubHint?: 'success' | 'pending' | 'expired';
};

export async function getPaymentStatus(
  id: string,
  options: GetPayByStatusOptions = {},
): Promise<PayByPayment> {
  if (getMode() === 'stub') {
    const hint = options.stubHint ?? 'success';
    const status =
      hint === 'pending' ? 'pending' : hint === 'expired' ? 'expired' : 'success';
    return { id, hostedUrl: '', status };
  }

  const data = await qippayFetch<PaymentStatusResponse>(
    `/v1/payment_status/${encodeURIComponent(id)}`,
    { method: 'GET' },
  );

  return {
    id: data.id,
    hostedUrl: data.url ?? '',
    status: data.status,
    expiresAt: data.expires_at,
  };
}


// --- Embedded flow ---------------------------------------------------------
// The immersive alternative to the Hosted redirect: the customer picks their
// bank + confirms their phone on OUR UI (via GET /v1/payment_providers, reused
// from the SetPay client), then we approve the payment directly — the bank
// either sends a CIBA push (we poll status) or returns a redirect straight to
// the bank's app/website (no Qippay Hosted Payment Page in between).
//
// NOTE: the PayBy *Embedded* endpoints are NOT in the Hosted spec (rev 9),
// which states Embedded is "not covered in this documentation". This mirrors
// the SetPay embedded shape (`POST /v1/approve_enduring`). The endpoint path is
// overridable via QIPPAY_PAYBY_APPROVE_PATH — CONFIRM against the PayBy
// Embedded spec before going live. Stub mode is fully functional offline.

export type PayByApproveMethod = 'redirect' | 'phone' | 'login_hint_token' | 'username';

export type PayByApproveInput = {
  paymentId: string; // pmU_...
  providerId: string;
  phone: string; // +64-XXXXXXXXX format
  method?: PayByApproveMethod;
  username?: string;
};

export type PayByApproveResponse = {
  paymentId?: string;
  method: 'CIBA' | 'redirect' | string;
  redirectUri?: string;
  message?: string;
};

type ApprovePaymentResponse = {
  paymentId?: string;
  method?: string;
  redirect_uri?: string;
  message?: string;
};

function getApprovePath(): string {
  return process.env.QIPPAY_PAYBY_APPROVE_PATH || '/v1/approve_payment';
}

export async function approvePayment(input: PayByApproveInput): Promise<PayByApproveResponse> {
  if (getMode() === 'stub') {
    // Simulate a redirect-style approval; the route handler fills redirectUri
    // with our success_url+stub=success so reconciliation works end-to-end.
    return { method: 'redirect', redirectUri: '', message: 'stubbed redirect' };
  }

  const body: Record<string, unknown> = {
    paymentId: input.paymentId,
    provider_id: input.providerId,
    phone: input.phone,
  };
  if (input.method) body.method = input.method;
  if (input.username) body.username = input.username;

  const data = await qippayFetch<ApprovePaymentResponse>(getApprovePath(), {
    method: 'POST',
    body,
  });

  return {
    paymentId: data.paymentId,
    method: (data.method ?? '').toUpperCase() === 'CIBA' ? 'CIBA' : 'redirect',
    redirectUri: data.redirect_uri || undefined,
    message: data.message,
  };
}
