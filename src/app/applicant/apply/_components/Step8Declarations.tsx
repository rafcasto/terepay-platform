'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';
import { useAuth } from '@/hooks/useAuth';
import { LOAN_INTEREST_RATE, computeApplicationFee } from '@/lib/constants/fees';

const errorCls = 'mt-1 text-xs text-red-600';

const DECLARATIONS = [
  {
    key: 'infoAccurate' as const,
    text: 'I confirm that all information provided in this application is true, accurate, and complete.',
  },
  {
    key: 'understandsVerification' as const,
    text: 'I understand that TerePay will verify the information I have provided.',
  },
  {
    key: 'authorisesContacts' as const,
    text: 'I authorise TerePay to contact my employer, references, and financial institutions to verify information.',
  },
  {
    key: 'understandsTerms' as const,
    text: 'I understand the loan terms: 49% APR, 8-week period, 4 fortnightly payments, and applicable fees.',
  },
  {
    key: 'canAffordRepayments' as const,
    text: 'I confirm I can afford the loan repayments without suffering substantial hardship.',
  },
  {
    key: 'receivedDisclosure' as const,
    text: 'I have received and read the TerePay Disclosure Statement and Terms & Conditions.',
  },
  {
    key: 'understandsConsequences' as const,
    text: 'I understand that failure to repay may result in additional fees, credit reporting, and collection action.',
  },
];

const PRIVACY_DECLARATIONS = [
  {
    key: 'privacyPolicy' as const,
    text: 'I have read and agree to the TerePay Privacy Policy.',
  },
  {
    key: 'creditReporting' as const,
    text: 'I authorise TerePay to collect personal information about me from credit reporting agencies (CRA) in connection with my application, disclose my information to CRAs, and allow CRAs to hold and share my information for credit reporting purposes.',
  },
];

export default function Step8Declarations() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();
  const { user } = useAuth();

  const e = errors.declarations;

  const requestedAmount = useWatch({ control, name: 'loanRequest.requestedAmount' }) ?? 0;
  const principal = Number(requestedAmount) || 0;
  const interest = principal * LOAN_INTEREST_RATE;
  const isExisting = user?.isExistingCustomer === true;
  const applicationFee = computeApplicationFee(isExisting);
  const totalRepayable = principal + interest + applicationFee;
  const fortnightlyPayment = totalRepayable / 4;
  const customerLabel = isExisting ? 'existing customer' : 'new customer';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Declarations &amp; Consent</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please read and confirm each declaration before submitting your application.{' '}
          For legal compliance, your consent must be confirmed fresh each time you submit.
        </p>
      </div>

      {/* Fees & Repayment Summary */}
      <div className="bg-[#FEF7E9] border border-[#F5A523]/30 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-[#E08B00] uppercase tracking-wide">
          Fees &amp; Repayment Summary
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-[#1C2740]">
          <div className="flex justify-between sm:block">
            <dt className="text-gray-600">Requested amount</dt>
            <dd className="font-semibold sm:mt-0.5">${principal.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-gray-600">Interest (4.7%)</dt>
            <dd className="font-semibold sm:mt-0.5">${interest.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-gray-600">Application fee</dt>
            <dd className="font-semibold sm:mt-0.5">
              ${applicationFee} <span className="text-xs font-normal text-gray-500">({customerLabel})</span>
            </dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-gray-600">Total repayable</dt>
            <dd className="font-bold sm:mt-0.5">${totalRepayable.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block sm:col-span-2 pt-2 border-t border-[#F5A523]/30">
            <dt className="text-gray-700 font-medium">Fortnightly payment</dt>
            <dd className="font-bold sm:mt-0.5">
              4 × ${fortnightlyPayment.toFixed(2)}
            </dd>
          </div>
        </dl>
        <p className="text-[11px] text-gray-500 leading-snug">
          Estimate based on your customer status at the time of submission. The application fee will be
          confirmed at approval.
        </p>
      </div>

      {/* Individual declarations */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Declarations</h3>
        {DECLARATIONS.map((decl) => (
          <label key={decl.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register(`declarations.${decl.key}`)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#F5A523] focus:ring-[#F5A523] shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">{decl.text}</span>
          </label>
        ))}
        {DECLARATIONS.map((decl) =>
          e?.[decl.key] ? (
            <p key={decl.key + '-err'} className={errorCls + ' -mt-2'}>
              {e[decl.key]?.message}
            </p>
          ) : null,
        )}
      </div>

      {/* Privacy and credit reporting */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Privacy Policy &amp; Credit Reporting Consent
        </h3>
        {PRIVACY_DECLARATIONS.map((decl) => (
          <div key={decl.key}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register(`declarations.${decl.key}`)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#F5A523] focus:ring-[#F5A523] shrink-0"
              />
              <span className="text-sm text-gray-700 leading-relaxed">{decl.text}</span>
            </label>
            {e?.[decl.key] && <p className={errorCls + ' ml-7'}>{e[decl.key]?.message}</p>}
          </div>
        ))}
      </div>

      {/* Footer branding */}
      <div className="border-t border-gray-200 pt-4 text-center space-y-1">
        <p className="text-xs font-semibold text-gray-700">TerePay Neophile Limited</p>
        <p className="text-xs text-gray-400">
          FSP1007414 | NZBN 9429052055232
        </p>
        <p className="text-xs text-gray-400">
          27 Henry Partington Place, Greenhithe 0632, New Zealand
        </p>
        <p className="text-xs text-gray-400">
          www.terepay.co.nz | info@terepay.co.nz
        </p>
      </div>
    </div>
  );
}
