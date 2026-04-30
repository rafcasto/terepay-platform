'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import KycAddressAutocomplete, { type AddressValue } from '../_components/KycAddressAutocomplete';

interface ProfileForm {
  dateOfBirth: string;
  immigrationStatus: string;
  visaExpiryDate: string;
  housingStatus: string;
  timeAtAddress: string;
  addressValue: AddressValue;
  isExistingClient: boolean | null;
  customerId: string;
}

type FieldErrors = Partial<Record<string, string>>;

const selectCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:outline-none transition-colors bg-white appearance-none';
const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:outline-none transition-colors bg-white';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'mt-1 text-xs text-red-600';
const readonlyCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed';

export default function KycProfilePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; email?: string } | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    dateOfBirth: '',
    immigrationStatus: '',
    visaExpiryDate: '',
    housingStatus: '',
    timeAtAddress: '',
    addressValue: { address: '', suburb: '', city: '', postCode: '', country: 'New Zealand' },
    isExistingClient: null,
    customerId: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Skip this step if profile details are already saved; also hydrate read-only fields
  useEffect(() => {
    fetch('/api/users/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d?.data?.immigrationStatus) {
          router.replace('/applicant/onboarding/identity');
          return;
        }
        if (d?.data) {
          setUser({
            firstName: d.data.firstName,
            lastName: d.data.lastName,
            email: d.data.email,
          });
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
    if (!form.immigrationStatus) errs.immigrationStatus = 'Immigration status is required';
    const needsExpiry = form.immigrationStatus && form.immigrationStatus !== 'citizen' && form.immigrationStatus !== 'permanent_resident';
    if (needsExpiry && !form.visaExpiryDate) errs.visaExpiryDate = 'Visa expiry date is required';
    if (!form.housingStatus) errs.housingStatus = 'Housing status is required';
    if (!form.timeAtAddress) errs.timeAtAddress = 'Please select how long you have lived here';
    if (!form.addressValue.address) errs.address = 'Address is required';
    if (!form.addressValue.city) errs.city = 'City is required';
    if (!form.addressValue.postCode) errs.postCode = 'Post code is required';
    if (form.isExistingClient === null) errs.isExistingClient = 'Please answer this question';
    if (form.isExistingClient === true && !form.customerId.trim())
      errs.customerId = 'Customer ID is required';
    if (
      form.isExistingClient === true &&
      form.customerId.trim() &&
      !/^TERE\d{3,}$/.test(form.customerId.trim().toUpperCase())
    )
      errs.customerId = 'Enter a valid TerePay Customer ID (e.g. TERE001)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      // ── If existing client: claim offline record first ──────────────────
      if (form.isExistingClient === true) {
        const claimRes = await fetch(
          `/api/customers/${encodeURIComponent(form.customerId.trim().toUpperCase())}/claim`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dateOfBirth: form.dateOfBirth }),
          },
        );
        if (!claimRes.ok) {
          const claimData = await claimRes.json();
          setApiError(
            claimData.error?.message ??
              'Details do not match. Please contact TerePay support.',
          );
          return;
        }
      }

      // ── Save profile details ────────────────────────────────────────────
      const res = await fetch('/api/kyc/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateOfBirth: form.dateOfBirth,
          immigrationStatus: form.immigrationStatus,
          visaExpiryDate: form.visaExpiryDate || undefined,
          housingStatus: form.housingStatus,
          timeAtAddress: form.timeAtAddress,
          address: form.addressValue.address,
          suburb: form.addressValue.suburb,
          city: form.addressValue.city,
          postCode: form.addressValue.postCode,
          country: form.addressValue.country,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error?.message ?? 'Failed to save profile. Please try again.');
        return;
      }
      router.push('/applicant/onboarding/identity');
    } catch {
      setApiError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start justify-center min-h-full py-8 px-4">
      {checking ? (
        <div className="flex justify-center w-full py-16">
          <svg className="animate-spin h-6 w-6 text-[#F5A523]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
      <div className="w-full max-w-lg">
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-[#0D1B2A]">Complete your profile</h2>
          <p className="text-gray-500 mt-1 text-sm">
            We need a few more details to verify your identity and process your application.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* ── Read-only user info ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First name</label>
              <input type="text" value={user?.firstName ?? ''} readOnly className={readonlyCls} tabIndex={-1} />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input type="text" value={user?.lastName ?? ''} readOnly className={readonlyCls} tabIndex={-1} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email address</label>
            <input type="email" value={user?.email ?? ''} readOnly className={readonlyCls} tabIndex={-1} />
          </div>

          {/* ── Existing TerePay client? ────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Are you an existing TerePay client?{' '}
              <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-3">
              {(['yes', 'no'] as const).map((opt) => {
                const isSelected =
                  opt === 'yes' ? form.isExistingClient === true : form.isExistingClient === false;
                return (
                  <label
                    key={opt}
                    className={[
                      'flex-1 text-center py-2.5 px-4 rounded-lg border-2 text-sm font-medium cursor-pointer transition-colors capitalize',
                      isSelected
                        ? 'border-[#F5A523] bg-[#FEF7E9] text-[#E08B00]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="isExistingClient"
                      className="sr-only"
                      onChange={() =>
                        set('isExistingClient', opt === 'yes' ? true : false)
                      }
                      checked={isSelected}
                    />
                    {opt === 'yes' ? 'Yes' : 'No'}
                  </label>
                );
              })}
            </div>
            {errors.isExistingClient && <p className={errorCls}>{errors.isExistingClient}</p>}

            {/* Customer ID field (shown only when Yes is selected) */}
            {form.isExistingClient === true && (
              <div className="mt-4">
                <label className={labelCls}>
                  TerePay Customer ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customerId}
                  onChange={(e) => {
                    set('customerId', e.target.value.toUpperCase());
                    setErrors((prev) => ({ ...prev, customerId: undefined }));
                  }}
                  placeholder="e.g. TERE001"
                  className={inputCls + ' font-mono uppercase'}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your Customer ID was provided by TerePay. Enter it here to link your existing records.
                </p>
                {errors.customerId && <p className={errorCls}>{errors.customerId}</p>}
              </div>
            )}
          </div>

          {/* ── Date of birth ───────────────────────────────────────────── */}
          <div>
            <label className={labelCls}>
              Date of birth <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              max={eighteenYearsAgo()}
              className={inputCls}
            />
            {errors.dateOfBirth && <p className={errorCls}>{errors.dateOfBirth}</p>}
          </div>

          {/* ── Immigration status ──────────────────────────────────────── */}
          <div>
            <label className={labelCls}>
              Immigration status <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={form.immigrationStatus}
                onChange={(e) => set('immigrationStatus', e.target.value)}
                className={selectCls}
              >
                <option value="">Select status…</option>
                <option value="citizen">Citizen</option>
                <option value="permanent_resident">Permanent Resident</option>
                <option value="resident">Resident Visa</option>
                <option value="work_visa">Work Visa</option>
                <option value="student">Student Visa</option>
              </select>
              <ChevronIcon />
            </div>
            {errors.immigrationStatus && <p className={errorCls}>{errors.immigrationStatus}</p>}
          </div>

          {/* ── Visa Expiry Date (hidden for citizen / permanent resident) ── */}
          {form.immigrationStatus !== '' &&
            form.immigrationStatus !== 'citizen' &&
            form.immigrationStatus !== 'permanent_resident' && (
            <div>
              <label className={labelCls}>
                Visa Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.visaExpiryDate}
                onChange={(e) => set('visaExpiryDate', e.target.value)}
                className={inputCls}
              />
              {errors.visaExpiryDate && <p className={errorCls}>{errors.visaExpiryDate}</p>}
            </div>
          )}

          {/* ── Address autocomplete ────────────────────────────────────── */}
          <KycAddressAutocomplete
            value={form.addressValue}
            onChange={(v) => {
              set('addressValue', v);
              setErrors((prev) => ({ ...prev, address: undefined, city: undefined, postCode: undefined }));
            }}
            errors={{ address: errors.address, city: errors.city, postCode: errors.postCode }}
          />

          {/* ── Time at address ─────────────────────────────────────────── */}
          <div>
            <label className={labelCls}>
              How long at this address? <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={form.timeAtAddress}
                onChange={(e) => set('timeAtAddress', e.target.value)}
                className={selectCls}
              >
                <option value="">Select duration…</option>
                <option value="lt_6mo">Less than 6 months</option>
                <option value="6_12mo">6–12 months</option>
                <option value="1_2yr">1–2 years</option>
                <option value="2_5yr">2–5 years</option>
                <option value="gt_5yr">5+ years</option>
              </select>
              <ChevronIcon />
            </div>
            {errors.timeAtAddress && <p className={errorCls}>{errors.timeAtAddress}</p>}
          </div>

          {/* ── Housing status ──────────────────────────────────────────── */}
          <div>
            <label className={labelCls}>
              Housing status <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3 flex-wrap">
              {(['rent', 'own', 'flatmates'] as const).map((opt) => (
                <label
                  key={opt}
                  className={[
                    'flex-1 min-w-[100px] text-center py-2.5 px-4 rounded-lg border-2 text-sm font-medium cursor-pointer transition-colors capitalize',
                    form.housingStatus === opt
                      ? 'border-[#F5A523] bg-[#FEF7E9] text-[#E08B00]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="housingStatus"
                    value={opt}
                    checked={form.housingStatus === opt}
                    onChange={() => set('housingStatus', opt)}
                    className="sr-only"
                  />
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
            {errors.housingStatus && <p className={errorCls}>{errors.housingStatus}</p>}
          </div>

          {apiError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F5A523] hover:bg-[#E08B00] disabled:opacity-60 text-white font-semibold rounded-full py-3.5 transition-colors mt-2"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
      )}
    </div>
  );
}

function eighteenYearsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split('T')[0];
}

function ChevronIcon() {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </span>
  );
}
