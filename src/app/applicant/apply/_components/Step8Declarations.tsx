'use client';

import { useFormContext } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

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
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.declarations;
  const allKeys = [...DECLARATIONS, ...PRIVACY_DECLARATIONS].map((d) => d.key);
  const allValues = watch(allKeys.map((k) => `declarations.${k}` as `declarations.${typeof k}`));
  const allChecked = allValues.every(Boolean);

  const handleCheckAll = (checked: boolean) => {
    allKeys.forEach((k) => {
      setValue(`declarations.${k}`, checked, { shouldValidate: true });
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Declarations &amp; Consent</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please read and confirm each declaration before submitting your application.
        </p>
      </div>

      {/* Check all */}
      <label className="flex items-center gap-3 cursor-pointer bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={(ev) => handleCheckAll(ev.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm font-semibold text-indigo-800">
          I confirm all declarations below
        </span>
      </label>

      {/* Individual declarations */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Declarations</h3>
        {DECLARATIONS.map((decl) => (
          <label key={decl.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register(`declarations.${decl.key}`)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
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
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
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
