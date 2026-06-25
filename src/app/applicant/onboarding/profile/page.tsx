'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui';
import KycAddressAutocomplete, { type AddressValue } from '../_components/KycAddressAutocomplete';
import { Spinner } from '../_components/Spinner';
import { SegmentedRadio } from '../_components/SegmentedRadio';
import {
  obLabel,
  obField,
  obSelect,
  obReadonly,
  obError,
  obPrimaryBtn,
  obAlert,
} from '../_components/onboarding-styles';

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

  // Hydrate user info and pre-populate any previously saved profile data
  useEffect(() => {
    fetch('/api/users/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) {
          setUser({
            firstName: d.data.firstName,
            lastName: d.data.lastName,
            email: d.data.email,
          });
          // Pre-populate form if profile was previously saved
          if (d.data.immigrationStatus) {
            setForm((prev) => ({
              ...prev,
              dateOfBirth: d.data.dateOfBirth ?? '',
              immigrationStatus: d.data.immigrationStatus ?? '',
              visaExpiryDate: d.data.visaExpiryDate ?? '',
              housingStatus: d.data.housingStatus ?? '',
              timeAtAddress: d.data.timeAtAddress ?? '',
              addressValue: {
                address: d.data.address ?? '',
                suburb: d.data.suburb ?? '',
                city: d.data.city ?? '',
                postCode: d.data.postCode ?? '',
                country: d.data.country ?? 'New Zealand',
              },
              // isExistingClient and customerId are intentionally not pre-populated
            }));
          }
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

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
          <Spinner size={24} className="text-brand-text" />
        </div>
      ) : (
      <div className="w-full max-w-lg screen-in">
        <div className="mb-7">
          <h2 className="font-display text-2xl font-bold text-ink-strong">Complete your profile</h2>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            We need a few more details to verify your identity and process your application.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* ── Read-only user info ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={obLabel}>First name</label>
              <input type="text" value={user?.firstName ?? ''} readOnly className={obReadonly} tabIndex={-1} />
            </div>
            <div>
              <label className={obLabel}>Last name</label>
              <input type="text" value={user?.lastName ?? ''} readOnly className={obReadonly} tabIndex={-1} />
            </div>
          </div>
          <div>
            <label className={obLabel}>Email address</label>
            <input type="email" value={user?.email ?? ''} readOnly className={obReadonly} tabIndex={-1} />
          </div>

          {/* ── Existing TerePay client? ────────────────────────────── */}
          <div className="rounded-xl border border-border-default bg-surface-sunken px-4 py-4">
            <p className="text-sm font-semibold text-ink-strong mb-3">
              Are you an existing TerePay client? <span className="text-danger-text">*</span>
            </p>
            <SegmentedRadio
              name="isExistingClient"
              value={form.isExistingClient === null ? null : form.isExistingClient ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
              onChange={(v) => set('isExistingClient', v === 'yes')}
            />
            {errors.isExistingClient && <p className={obError}>{errors.isExistingClient}</p>}

            {/* Customer ID field (shown only when Yes is selected) */}
            {form.isExistingClient === true && (
              <div className="mt-4">
                <label className={obLabel}>
                  TerePay Customer ID <span className="text-danger-text">*</span>
                </label>
                <input
                  type="text"
                  value={form.customerId}
                  onChange={(e) => {
                    set('customerId', e.target.value.toUpperCase());
                    setErrors((prev) => ({ ...prev, customerId: undefined }));
                  }}
                  placeholder="e.g. TERE001"
                  className={`${obField} font-tabular uppercase`}
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Your Customer ID was provided by TerePay. Enter it here to link your existing records.
                </p>
                {errors.customerId && <p className={obError}>{errors.customerId}</p>}
              </div>
            )}
          </div>

          {/* ── Date of birth ───────────────────────────────────────────── */}
          <div>
            <label className={obLabel}>
              Date of birth <span className="text-danger-text">*</span>
            </label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              max={eighteenYearsAgo()}
              className={obField}
            />
            {errors.dateOfBirth && <p className={obError}>{errors.dateOfBirth}</p>}
          </div>

          {/* ── Immigration status ──────────────────────────────────────── */}
          <div>
            <label className={obLabel}>
              Immigration status <span className="text-danger-text">*</span>
            </label>
            <div className="relative">
              <select
                value={form.immigrationStatus}
                onChange={(e) => set('immigrationStatus', e.target.value)}
                className={obSelect}
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
            {errors.immigrationStatus && <p className={obError}>{errors.immigrationStatus}</p>}
          </div>

          {/* ── Visa Expiry Date (hidden for citizen / permanent resident) ── */}
          {form.immigrationStatus !== '' &&
            form.immigrationStatus !== 'citizen' &&
            form.immigrationStatus !== 'permanent_resident' && (
            <div>
              <label className={obLabel}>
                Visa Expiry Date <span className="text-danger-text">*</span>
              </label>
              <input
                type="date"
                value={form.visaExpiryDate}
                onChange={(e) => set('visaExpiryDate', e.target.value)}
                className={obField}
              />
              {errors.visaExpiryDate && <p className={obError}>{errors.visaExpiryDate}</p>}
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
            <label className={obLabel}>
              How long at this address? <span className="text-danger-text">*</span>
            </label>
            <div className="relative">
              <select
                value={form.timeAtAddress}
                onChange={(e) => set('timeAtAddress', e.target.value)}
                className={obSelect}
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
            {errors.timeAtAddress && <p className={obError}>{errors.timeAtAddress}</p>}
          </div>

          {/* ── Housing status ──────────────────────────────────────────── */}
          <div>
            <label className={obLabel}>
              Housing status <span className="text-danger-text">*</span>
            </label>
            <SegmentedRadio
              name="housingStatus"
              value={form.housingStatus || null}
              options={[
                { value: 'rent', label: 'Rent' },
                { value: 'own', label: 'Own' },
                { value: 'flatmates', label: 'Flatmates' },
              ]}
              onChange={(v) => set('housingStatus', v)}
            />
            {errors.housingStatus && <p className={obError}>{errors.housingStatus}</p>}
          </div>

          {apiError && <div className={obAlert}>{apiError}</div>}

          <button type="submit" disabled={loading} className={`${obPrimaryBtn} mt-2`}>
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
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
      <Icons.ChevronDown size={18} />
    </span>
  );
}
