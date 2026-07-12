import { AppError } from '@/lib/utils/api-error';

// Shared low-level HTTP plumbing for the Qippay APIs (SetPay + PayBy). Both
// integrations authenticate with the same Bearer client secret against the
// same base URL and share the `{ success, data, error }` response envelope, so
// the fetch/parse/error-mapping logic lives here once.

export function getQippayBaseUrl(): string {
  const baseUrl = process.env.QIPPAY_BASE_URL ?? '';
  if (!baseUrl) {
    throw new AppError('QIPPAY_NOT_CONFIGURED', 500, 'QIPPAY_BASE_URL is not configured');
  }
  return baseUrl.replace(/\/$/, '');
}

export function getQippayClientSecret(): string {
  const secret = process.env.QIPPAY_CLIENT_SECRET ?? '';
  if (!secret) {
    throw new AppError('QIPPAY_NOT_CONFIGURED', 500, 'QIPPAY_CLIENT_SECRET is not configured');
  }
  return secret;
}

export type QippayEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string } | string;
};

export async function qippayFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const baseUrl = getQippayBaseUrl();
  const secret = getQippayClientSecret();

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
      'Bank payment service temporarily unavailable',
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
      throw new AppError('QIPPAY_UPSTREAM', 502, errMsg, { qippayStatus: res.status });
    }
    throw new AppError('QIPPAY_BAD_REQUEST', 502, errMsg, { qippayStatus: res.status });
  }

  return envelope.data;
}
