import { AppError } from '@/lib/utils/api-error';

// Qippay SetPay (Integrated v1.0, rev 1 May 2026) — open-banking enduring
// payment consent (NZ direct-debit replacement). This client uses the
// Hosted-style entry point: a single POST /v1/enduring_initiation returns
// a `url` that the applicant is redirected to for bank selection and
// approval, then bounces back to our success/failure URLs. The fully
// embedded flow (separate /v1/approve_enduring + CIBA polling) is not
// used here — we want a one-redirect UX matching our applicant flow.
//
// Spec: https://www.qippay.com/setpay (developer doc, rev 1)

export type SetPayMode = 'live' | 'stub';

export type SetPayInstallment = {
  dueDate: string; // YYYY-MM-DD
  amountCents: number;
};

export type SetPayFrequencyPeriod =
  | 'Daily'
  | 'Weekly'
  | 'Fortnightly'
  | 'Monthly'
  | 'Annual';

export type SetPayCreateMandateInput = {
  beneficiaryId: string;
  successUrl: string;
  failureUrl: string;
  customerIp: string;
  customerUserAgent: string;
  merchantCustomerIdentification: string;
  metadata?: Record<string, string>;

  // SetPay consent terms (mirror /v1/enduring_initiation body fields).
  frequencyPeriod: SetPayFrequencyPeriod;
  frequencyTotalAmountCents: number;
  totalAmountCents?: number;
  totalCount?: number;
  fromDateTime?: string; // ISO 8601 with TZ
  toDateTime?: string; // ISO 8601 with TZ

  // Retained for our own bookkeeping & UI rendering (not sent to Qippay
  // outside the consent terms above).
  installments: SetPayInstallment[];
};

export type SetPayMandate = {
  id: string; // epcId
  hostedUrl: string;
  status: string; // upstream raw status string
  expiresAt?: string;
  verifiedBankAccount?: {
    accountNumber: string;
    accountName?: string;
    bankName?: string; // provider_id (e.g. pp_purple) — bank name lookup is a future enhancement
  };
};

type EnvConfig = {
  baseUrl: string;
  clientSecret: string;
  beneficiaryId: string;
  mode: SetPayMode;
  returnBaseUrl: string;
};

function readEnv(): EnvConfig {
  const baseUrl = process.env.QIPPAY_BASE_URL ?? '';
  const clientSecret = process.env.QIPPAY_CLIENT_SECRET ?? '';
  const beneficiaryId = process.env.QIPPAY_BENEFICIARY_ID ?? '';
  const rawMode = (process.env.QIPPAY_MODE ?? 'stub').toLowerCase();
  const mode: SetPayMode = rawMode === 'live' ? 'live' : 'stub';
  const returnBaseUrl = process.env.QIPPAY_RETURN_BASE_URL ?? '';

  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  if (mode === 'stub' && isProd) {
    throw new AppError(
      'QIPPAY_STUB_FORBIDDEN_IN_PROD',
      500,
      'Qippay stub mode cannot be used in production. Set QIPPAY_MODE=live.',
    );
  }

  return { baseUrl, clientSecret, beneficiaryId, mode, returnBaseUrl };
}

export function getBeneficiaryId(): string {
  const { beneficiaryId, mode } = readEnv();
  if (beneficiaryId) return beneficiaryId;
  if (mode === 'stub') return 'bfy_stub_terepay';
  throw new AppError(
    'QIPPAY_NOT_CONFIGURED',
    500,
    'QIPPAY_BENEFICIARY_ID is not configured',
  );
}

export function getReturnBaseUrl(): string {
  const { returnBaseUrl, mode } = readEnv();
  if (returnBaseUrl) return returnBaseUrl.replace(/\/$/, '');
  if (mode === 'stub') {
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  }
  throw new AppError(
    'QIPPAY_NOT_CONFIGURED',
    500,
    'QIPPAY_RETURN_BASE_URL is not configured',
  );
}

export function getMode(): SetPayMode {
  return readEnv().mode;
}

function getBaseUrl(): string {
  const { baseUrl } = readEnv();
  if (!baseUrl) {
    throw new AppError(
      'QIPPAY_NOT_CONFIGURED',
      500,
      'QIPPAY_BASE_URL is not configured',
    );
  }
  return baseUrl.replace(/\/$/, '');
}

function getClientSecret(): string {
  const { clientSecret } = readEnv();
  if (!clientSecret) {
    throw new AppError(
      'QIPPAY_NOT_CONFIGURED',
      500,
      'QIPPAY_CLIENT_SECRET is not configured',
    );
  }
  return clientSecret;
}

function stubHostedUrl(successUrl: string): string {
  const u = new URL(successUrl);
  u.searchParams.set('stub', 'success');
  return u.toString();
}

type QippayEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string } | string;
};

type EnduringInitiationResponse = {
  id: string;
  url: string;
  status: string;
  expires_at?: string;
  beneficiary?: {
    id?: string[];
    name?: string[];
    account_name?: string[];
    account_number?: string[];
  };
  debtor_account_number?: string | null;
  provider_id?: string | null;
};

async function qippayFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const baseUrl = getBaseUrl();
  const secret = getClientSecret();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new AppError(
      'QIPPAY_UPSTREAM',
      502,
      'Bank authorization service temporarily unavailable',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  let envelope: QippayEnvelope<T> | undefined;
  try {
    envelope = (await res.json()) as QippayEnvelope<T>;
  } catch {
    // Non-JSON response — fall through to status-based mapping below.
  }

  if (!res.ok || !envelope?.success || !envelope.data) {
    const errMsg =
      typeof envelope?.error === 'string'
        ? envelope.error
        : envelope?.error?.message ?? res.statusText ?? 'Qippay request failed';
    if (res.status >= 500 || res.status === 0) {
      throw new AppError('QIPPAY_UPSTREAM', 502, errMsg, {
        qippayStatus: res.status,
      });
    }
    throw new AppError('QIPPAY_BAD_REQUEST', 502, errMsg, {
      qippayStatus: res.status,
    });
  }

  return envelope.data;
}

function mapInitiationResponseToMandate(
  data: EnduringInitiationResponse,
): SetPayMandate {
  const debtor = data.debtor_account_number ?? undefined;
  return {
    id: data.id,
    hostedUrl: data.url,
    status: data.status,
    expiresAt: data.expires_at,
    verifiedBankAccount: debtor
      ? {
          accountNumber: debtor,
          bankName: data.provider_id ?? undefined,
        }
      : undefined,
  };
}

export async function createMandate(
  input: SetPayCreateMandateInput,
): Promise<SetPayMandate> {
  const env = readEnv();

  if (env.mode === 'stub') {
    const ts = Date.now();
    return {
      id: `stub_mandate_${input.merchantCustomerIdentification}_${ts}`,
      hostedUrl: stubHostedUrl(input.successUrl),
      status: 'awaiting_redirect',
      expiresAt: new Date(ts + 60 * 60 * 1000).toISOString(),
    };
  }

  const body: Record<string, unknown> = {
    beneficiary_id: [input.beneficiaryId],
    success_url: input.successUrl,
    failure_url: input.failureUrl,
    customer_ip_address: input.customerIp,
    customer_user_agent: input.customerUserAgent,
    merchant_customer_identification: input.merchantCustomerIdentification,
    frequency_period: input.frequencyPeriod,
    frequency_total_amount: {
      currency: 'NZD',
      value: input.frequencyTotalAmountCents,
    },
  };
  if (input.totalAmountCents !== undefined) {
    body.total_amount = { currency: 'NZD', value: input.totalAmountCents };
  }
  if (input.totalCount !== undefined) {
    body.total_count = input.totalCount;
  }
  if (input.fromDateTime) body.from_date_time = input.fromDateTime;
  if (input.toDateTime) body.to_date_time = input.toDateTime;
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    body.metadata = input.metadata;
  }

  const data = await qippayFetch<EnduringInitiationResponse>(
    '/v1/enduring_initiation',
    { method: 'POST', body },
  );
  return mapInitiationResponseToMandate(data);
}

export type GetMandateStatusOptions = {
  stubHint?: 'success' | 'failure' | 'pending';
};

export async function getMandateStatus(
  id: string,
  options: GetMandateStatusOptions = {},
): Promise<SetPayMandate> {
  const env = readEnv();

  if (env.mode === 'stub') {
    const hint = options.stubHint ?? 'success';
    if (hint === 'pending') {
      return { id, hostedUrl: '', status: 'pending' };
    }
    if (hint === 'failure') {
      return { id, hostedUrl: '', status: 'failed' };
    }
    return {
      id,
      hostedUrl: '',
      status: 'success',
      verifiedBankAccount: {
        accountNumber: '01-2345-6789012-00',
        accountName: 'Stub Customer',
        bankName: 'pp_purple',
      },
    };
  }

  const data = await qippayFetch<EnduringInitiationResponse>(
    `/v1/enduring_initiation/${encodeURIComponent(id)}`,
    { method: 'GET' },
  );
  return mapInitiationResponseToMandate(data);
}

// Normalises the upstream raw SetPay status string into our PaymentConsentStatus
// vocabulary. SetPay statuses per the spec: awaiting_redirect, pending, expired*,
// success, revoked (post-approval), cancelled (post-approval).
export function normaliseStatus(
  raw: string,
): 'active' | 'failed' | 'expired' | 'cancelled' | 'initiated' {
  const s = raw.toLowerCase();
  if (s === 'success' || s === 'authorised' || s === 'authorized') return 'active';
  if (s.startsWith('expired')) return 'expired';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'revoked') return 'cancelled';
  if (s === 'failed' || s === 'declined') return 'failed';
  return 'initiated';
}

// --- Embedded flow primitives ---------------------------------------------

export type SetPayProvider = {
  id: string;
  name: string;
  logoUrl?: string;
  website?: string;
};

type PaymentProviderResponseItem = {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
};

export async function listProviders(): Promise<SetPayProvider[]> {
  const env = readEnv();

  if (env.mode === 'stub') {
    return [
      { id: 'pp_orange', name: 'The Orange Bank' },
      { id: 'pp_purple', name: 'The Purple Bank' },
      { id: 'pp_grey', name: 'The Grey Bank' },
    ];
  }

  const data = await qippayFetch<PaymentProviderResponseItem[]>(
    '/v1/payment_providers',
    { method: 'GET' },
  );
  return data.map((d) => ({
    id: d.id,
    name: d.name,
    logoUrl: d.logo_url,
    website: d.website,
  }));
}

export type SetPayApproveMethod = 'redirect' | 'phone' | 'login_hint_token' | 'username';

export type SetPayApproveInput = {
  epcId: string;
  providerId: string;
  phone: string; // +64-XXXXXXXXX format
  method?: SetPayApproveMethod;
  username?: string;
};

export type SetPayApproveResponse = {
  paymentId?: string;
  method: 'CIBA' | 'redirect' | string;
  redirectUri?: string;
  message?: string;
};

type ApproveEnduringResponse = {
  paymentId?: string;
  method?: string;
  redirect_uri?: string;
  message?: string;
};

export async function approveEnduring(
  input: SetPayApproveInput,
): Promise<SetPayApproveResponse> {
  const env = readEnv();

  if (env.mode === 'stub') {
    // In stub mode we simulate a redirect-style approval that points back
    // to our return page with stub=success so the existing reconciliation
    // path still works end-to-end without internet.
    return {
      method: 'redirect',
      redirectUri: '', // route handler fills this with our success_url+stub=success
      message: 'stubbed redirect',
    };
  }

  const body: Record<string, unknown> = {
    epcId: input.epcId,
    provider_id: input.providerId,
    phone: input.phone,
  };
  if (input.method) body.method = input.method;
  if (input.username) body.username = input.username;

  const data = await qippayFetch<ApproveEnduringResponse>('/v1/approve_enduring', {
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

// --- Scheduled-payment primitives ----------------------------------------
// SetPay requires each individual instalment to be scheduled via POST
// /v1/setpay (docs rev 1, p.19). The enduring consent only authorises
// limits — Qippay does not auto-fire payments on its own.

export type SetPaySchedulePaymentInput = {
  epcId: string;
  beneficiaryId: string;
  amountCents: number;
  scheduledFor: string; // ISO 8601 with TZ. Must be a future date (Pacific/Auckland).
  statementParticulars: string; // max 12 chars, alphanumeric + space/-/'/?
  statementCode: string;
  statementReference: string;
  maxRetry?: number; // optional Qippay-side retry on failure
};

export type SetPayScheduledPayment = {
  paymentId: string; // `pmU_...` — what webhook events reference
  enduringPaymentId: string; // `epU_...` — the schedule instance id
  scheduledDate: string; // ISO 8601
  status: string; // upstream raw status (e.g. "Scheduled")
};

type SchedulePaymentResponse = {
  id: string; // epU_...
  scheduled_date: string;
  scheduled_desc?: string;
  payment: {
    id: string; // pmU_...
    status: string;
    [k: string]: unknown;
  };
  consent_overall_status?: unknown;
  scheduled_period_status?: unknown;
};

// Qippay-permitted chars for statement_* fields: alphanumeric, space, -, ', ?
// Trim/strip anything else and clamp to 12 chars to avoid 422 from Qippay.
function sanitiseStatementField(input: string, fallback: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9 \-'?]/g, '').trim().slice(0, 12);
  return cleaned || fallback.slice(0, 12);
}

export async function schedulePayment(
  input: SetPaySchedulePaymentInput,
): Promise<SetPayScheduledPayment> {
  const env = readEnv();
  const particulars = sanitiseStatementField(input.statementParticulars, 'TerePay');
  const code = sanitiseStatementField(input.statementCode, 'LOAN');
  const reference = sanitiseStatementField(input.statementReference, 'PMT');

  if (env.mode === 'stub') {
    // Deterministic IDs derived from the epcId + scheduled date so re-runs in
    // tests are stable and idempotent retries don't produce new IDs.
    const tag = `${input.epcId.slice(-8)}_${input.scheduledFor.slice(0, 10)}`;
    return {
      paymentId: `stub_pmt_${tag}`,
      enduringPaymentId: `stub_ep_${tag}`,
      scheduledDate: input.scheduledFor,
      status: 'Scheduled',
    };
  }

  const body: Record<string, unknown> = {
    beneficiary_id: input.beneficiaryId,
    epcId: input.epcId,
    amount: { currency: 'NZD', value: input.amountCents },
    statement_particulars: particulars,
    statement_code: code,
    statement_reference: reference,
    scheduled_for: input.scheduledFor,
  };
  if (input.maxRetry !== undefined) body.max_retry = input.maxRetry;

  const data = await qippayFetch<SchedulePaymentResponse>('/v1/setpay', {
    method: 'POST',
    body,
  });

  return {
    paymentId: data.payment.id,
    enduringPaymentId: data.id,
    scheduledDate: data.scheduled_date,
    status: data.payment.status,
  };
}

// Normalise an NZ phone string into Qippay's required +[cc]-[digits] format.
// Accepts common shapes ("021 123 4567", "+64 21 123 4567", "+64-21-123-4567").
export function normaliseNzPhoneForQippay(input: string): string {
  const raw = input.replace(/[^\d+]/g, '');
  if (raw.startsWith('+64')) return `+64-${raw.slice(3)}`;
  if (raw.startsWith('64')) return `+64-${raw.slice(2)}`;
  if (raw.startsWith('+')) {
    // Already in +cc form for another country — split at the country code length.
    // For simplicity, treat first 1-3 digits after + as the country code.
    const m = raw.match(/^\+(\d{1,3})(.*)$/);
    if (m) return `+${m[1]}-${m[2]}`;
    return raw;
  }
  if (raw.startsWith('0')) return `+64-${raw.slice(1)}`;
  return `+64-${raw}`;
}
