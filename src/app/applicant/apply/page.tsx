'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createApplicationSchema, type CreateApplicationInput } from '@/lib/validation/schemas';
import { useState } from 'react';

const LOAN_PURPOSES = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'auto', label: 'Auto' },
  { value: 'home_improvement', label: 'Home Improvement' },
  { value: 'consolidation', label: 'Debt Consolidation' },
  { value: 'other', label: 'Other' },
] as const;

export default function ApplyPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateApplicationInput>({ resolver: zodResolver(createApplicationSchema) });

  const onSubmit = async (data: CreateApplicationInput) => {
    setServerError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message ?? 'Failed to create application');
      }

      router.push('/applicant/applications');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Apply for a Loan</h1>
      <p className="text-gray-500 mb-8">Fill out the form below to start your loan application.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {/* Loan Details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Loan Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requested Amount (USD)
            </label>
            <input
              type="number"
              min={100}
              max={50000}
              {...register('loanDetails.requestedAmount', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. 2500"
            />
            {errors.loanDetails?.requestedAmount && (
              <p className="mt-1 text-xs text-red-600">{errors.loanDetails.requestedAmount.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Purpose</label>
            <select
              {...register('loanDetails.loanPurpose')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="">Select a purpose…</option>
              {LOAN_PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {errors.loanDetails?.loanPurpose && (
              <p className="mt-1 text-xs text-red-600">{errors.loanDetails.loanPurpose.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purpose Description
            </label>
            <textarea
              rows={3}
              {...register('loanDetails.purposeDescription')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              placeholder="Briefly describe how you will use this loan…"
            />
            {errors.loanDetails?.purposeDescription && (
              <p className="mt-1 text-xs text-red-600">{errors.loanDetails.purposeDescription.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requested Term (months)
            </label>
            <input
              type="number"
              min={3}
              max={60}
              {...register('loanDetails.requestedTerm', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. 12"
            />
          </div>
        </section>

        {/* Financial Information */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Financial Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Income ($)
              </label>
              <input
                type="number"
                min={0}
                {...register('financialInformation.monthlyIncome', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {errors.financialInformation?.monthlyIncome && (
                <p className="mt-1 text-xs text-red-600">{errors.financialInformation.monthlyIncome.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Expenses ($)
              </label>
              <input
                type="number"
                min={0}
                {...register('financialInformation.monthlyExpenses', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Income Source</label>
              <input
                type="text"
                {...register('financialInformation.incomeSource')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Employment"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <input
                type="text"
                {...register('financialInformation.employmentType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Full-time"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Debts ($)
              </label>
              <input
                type="number"
                min={0}
                defaultValue={0}
                {...register('financialInformation.currentDebts', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Existing Loans (#)
              </label>
              <input
                type="number"
                min={0}
                defaultValue={0}
                {...register('financialInformation.existingLoans', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Savings Balance ($)
            </label>
            <input
              type="number"
              min={0}
              defaultValue={0}
              {...register('financialInformation.savingsBalance', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </section>

        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{serverError}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Saving…' : 'Save as Draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
