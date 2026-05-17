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
