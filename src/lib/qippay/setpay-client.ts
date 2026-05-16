import { AppError } from '@/lib/utils/api-error';

// SetPay is Qippay's recurring open-banking mandate product. The developer
// spec is not yet in our hands; this module exposes a typed surface so the
// rest of the integration (data model, routes, UI) can be built and tested
// in `stub` mode today. The `live` branch is a deliberate 501 — flipping to
// real HTTP needs the upstream contract to land first.
//
// Field names marked `// TBC` will be reconciled with the SetPay docs.

export type SetPayMode = 'live' | 'stub';

export type SetPayInstallment = {
  dueDate: string; // YYYY-MM-DD
  amountCents: number;
};

export type SetPayCreateMandateInput = {
  beneficiaryId: string;
  successUrl: string;
  failureUrl: string;
  schedule: {
    currency: 'NZD';
    installments: SetPayInstallment[];
  };
  customerIp: string;
  customerUserAgent: string;
  merchantCustomerIdentification: string; // applicant uid
  metadata?: Record<string, string>;
};

export type SetPayMandate = {
  id: string; // TBC
  hostedUrl: string; // TBC
  status: string; // upstream raw status string
  expiresAt?: string;
  verifiedBankAccount?: {
    accountNumber: string;
    accountName?: string;
    bankName?: string;
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
    // In stub mode, fall back to a request-host-relative URL so the dev
    // workflow doesn't require setting QIPPAY_RETURN_BASE_URL.
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

function stubMandateIdFor(merchantCustomerIdentification: string, ts: number): string {
  return `stub_mandate_${merchantCustomerIdentification}_${ts}`;
}

// In stub mode the hosted "page" is our own return URL. The query string
// `?stub=success|failure` lets us deterministically drive the status check
// without ever calling Qippay.
function stubHostedUrl(successUrl: string): string {
  const u = new URL(successUrl);
  u.searchParams.set('stub', 'success');
  return u.toString();
}

export async function createMandate(
  input: SetPayCreateMandateInput,
): Promise<SetPayMandate> {
  const env = readEnv();

  if (env.mode === 'stub') {
    const ts = Date.now();
    return {
      id: stubMandateIdFor(input.merchantCustomerIdentification, ts),
      hostedUrl: stubHostedUrl(input.successUrl),
      status: 'initiated',
      expiresAt: new Date(ts + 60 * 60 * 1000).toISOString(),
    };
  }

  // live: not implemented — see module docstring.
  throw new AppError(
    'NOT_IMPLEMENTED',
    501,
    'SetPay live client is awaiting Qippay developer documentation',
  );
}

// In stub mode we infer status from query-string hints surfaced through the
// return-URL flow. The route handler passes the hint via `stubHint`.
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
      status: 'active',
      verifiedBankAccount: {
        accountNumber: '01-2345-6789012-00',
        accountName: 'Stub Customer',
        bankName: 'Stub Bank',
      },
    };
  }

  throw new AppError(
    'NOT_IMPLEMENTED',
    501,
    'SetPay live client is awaiting Qippay developer documentation',
  );
}

// Normalises the upstream raw status string into our PaymentConsentStatus.
// Lives in the client module so SetPay-specific vocabulary doesn't leak into
// the API routes.
export function normaliseStatus(
  raw: string,
): 'active' | 'failed' | 'expired' | 'cancelled' | 'initiated' {
  const s = raw.toLowerCase();
  if (s === 'active' || s === 'success' || s === 'approved') return 'active';
  if (s.startsWith('expired')) return 'expired';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'failed' || s === 'declined') return 'failed';
  return 'initiated';
}
