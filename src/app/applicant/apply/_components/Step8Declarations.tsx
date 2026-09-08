'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';
import { useAuth } from '@/hooks/useAuth';
import { computeRepayment } from '@/lib/loan/status-display';
import { useSiteContent } from '@/lib/content/SiteContentContext';

const errorCls = 'mt-1.5 text-xs text-danger-text font-medium';

// Declaration keys map to form fields (fixed); the wording for each is
// editable copy in the `apply.step8` content section.
const DECLARATION_KEYS = [
  { key: 'infoAccurate', contentKey: 'decl1' },
  { key: 'understandsVerification', contentKey: 'decl2' },
  { key: 'authorisesContacts', contentKey: 'decl3' },
  { key: 'understandsTerms', contentKey: 'decl4' },
  { key: 'canAffordRepayments', contentKey: 'decl5' },
  { key: 'receivedDisclosure', contentKey: 'decl6' },
  { key: 'understandsConsequences', contentKey: 'decl7' },
] as const;

const PRIVACY_DECLARATION_KEYS = [
  { key: 'privacyPolicy', contentKey: 'privacy1' },
  { key: 'creditReporting', contentKey: 'privacy2' },
] as const;

type DeclarationKey =
  | (typeof DECLARATION_KEYS)[number]['key']
  | (typeof PRIVACY_DECLARATION_KEYS)[number]['key'];

export default function Step8Declarations() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();
  const { user } = useAuth();
  const c = useSiteContent('apply.step8');

  const e = errors.declarations;

  const requestedAmount = useWatch({ control, name: 'loanRequest.requestedAmount' }) ?? 0;
  const principal = Number(requestedAmount) || 0;
  const isExisting = user?.isExistingCustomer === true;
  // The application fee is deducted from the disbursement, NOT amortised into
  // the repayments, so it must not be added to `totalRepayable` here.
  const quote = computeRepayment(principal, isExisting);
  const interest = quote.interest;
  const applicationFee = quote.fee;
  const totalRepayable = quote.totalRepayable;
  const fortnightlyPayment = quote.instalmentAmount;
  const customerLabel = isExisting ? 'existing customer' : 'new customer';

  const renderDeclaration = (decl: { key: DeclarationKey; contentKey: string }) => (
    <div key={decl.key}>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          {...register(`declarations.${decl.key}`)}
          className="mt-0.5 h-4 w-4 rounded border-border-default text-brand-text focus:ring-[var(--focus-ring)] shrink-0"
        />
        <span className="text-sm text-ink-strong leading-relaxed">{c[decl.contentKey]}</span>
      </label>
      {e?.[decl.key] && <p className={errorCls + ' ml-7'}>{e[decl.key]?.message}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">{c.title}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">{c.intro}</p>
      </div>

      {/* Fees & Repayment Summary */}
      <div className="bg-brand-soft border border-brand/30 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-brand-text uppercase tracking-wide">{c.summaryHeading}</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink-strong">
          <div className="flex justify-between sm:block">
            <dt className="text-[var(--text-muted)]">Requested amount</dt>
            <dd className="font-semibold sm:mt-0.5">${principal.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-[var(--text-muted)]">Interest (49% p.a.)</dt>
            <dd className="font-semibold sm:mt-0.5">${interest.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-[var(--text-muted)]">Application fee</dt>
            <dd className="font-semibold sm:mt-0.5">
              ${applicationFee} <span className="text-xs font-normal text-[var(--text-muted)]">({customerLabel})</span>
            </dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-[var(--text-muted)]">Total repayable</dt>
            <dd className="font-bold sm:mt-0.5">${totalRepayable.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block sm:col-span-2 pt-2 border-t border-brand/30">
            <dt className="text-ink-strong font-medium">Fortnightly payment</dt>
            <dd className="font-bold sm:mt-0.5">
              4 × ${fortnightlyPayment.toFixed(2)}
              <span className="block text-[11px] font-normal text-[var(--text-muted)]">
                final payment adjusted to clear the balance
              </span>
            </dd>
          </div>
        </dl>
        <p className="text-[11px] text-[var(--text-muted)] leading-snug">{c.summaryNote}</p>
      </div>

      {/* Individual declarations */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">{c.declarationsHeading}</h3>
        {DECLARATION_KEYS.map(renderDeclaration)}
      </div>

      {/* Privacy and credit reporting */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">{c.privacyHeading}</h3>
        {PRIVACY_DECLARATION_KEYS.map(renderDeclaration)}
      </div>

      {/* Footer branding */}
      <div className="border-t border-border-default pt-4 text-center space-y-1">
        <p className="text-xs font-semibold text-ink-strong">TerePay Neophile Limited</p>
        <p className="text-xs text-[var(--text-disabled)]">
          FSP1007414 | NZBN 9429052055232
        </p>
        <p className="text-xs text-[var(--text-disabled)]">
          27 Henry Partington Place, Greenhithe 0632, New Zealand
        </p>
        <p className="text-xs text-[var(--text-disabled)]">
          www.terepay.co.nz | info@terepay.co.nz
        </p>
      </div>
    </div>
  );
}
