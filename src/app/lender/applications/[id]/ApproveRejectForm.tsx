'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Client-side shape — must match backend Zod schema (approveApplicationSchema / rejectApplicationSchema)
const approveSchema = z.object({
  approvedAmount: z.number().positive('Required'),
  approvedRate: z.number().min(0).max(100),
  approvedTerm: z.number().int().positive(),
  comments: z.string().optional(),
});

const rejectSchema = z.object({
  comments: z.string().min(10, 'Please provide a reason (min 10 chars)'),
});

type ApproveInput = z.infer<typeof approveSchema>;
type RejectInput = z.infer<typeof rejectSchema>;

export default function ApproveRejectForm({
  applicationId,
  requestedAmount,
  requestedTerm,
}: {
  applicationId: string;
  requestedAmount?: number;
  requestedTerm?: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const approveForm = useForm<ApproveInput>({
    resolver: zodResolver(approveSchema),
    defaultValues: {
      approvedAmount: requestedAmount,
      approvedRate: 12,
      approvedTerm: requestedTerm ?? 12,
    },
  });

  const rejectForm = useForm<RejectInput>({ resolver: zodResolver(rejectSchema) });

  const submit = async (body: Record<string, unknown>) => {
    setServerError(null);
    const res = await fetch(`/api/applications/${applicationId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? 'Request failed');
    router.refresh();
  };

  const onApprove = approveForm.handleSubmit(async (data) => {
    try { await submit({ action: 'approve', ...data }); } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong');
    }
  });

  const onReject = rejectForm.handleSubmit(async (data) => {
    try { await submit({ action: 'reject', ...data }); } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong');
    }
  });

  if (mode === 'idle') {
    return (
      <div className="flex gap-3">
        <button
          onClick={() => setMode('approve')}
          className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => setMode('reject')}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Reject
        </button>
      </div>
    );
  }

  if (mode === 'approve') {
    return (
      <form onSubmit={onApprove} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approved Amount ($)</label>
            <input
              type="number"
              {...approveForm.register('approvedAmount', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            {approveForm.formState.errors.approvedAmount && (
              <p className="mt-1 text-xs text-red-600">{approveForm.formState.errors.approvedAmount.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
            <input
              type="number"
              step="0.01"
              {...approveForm.register('approvedRate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            {approveForm.formState.errors.approvedRate && (
              <p className="mt-1 text-xs text-red-600">{approveForm.formState.errors.approvedRate.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term (months)</label>
            <input
              type="number"
              {...approveForm.register('approvedTerm', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            {...approveForm.register('comments')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none resize-none"
          />
        </div>
        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={approveForm.formState.isSubmitting}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {approveForm.formState.isSubmitting ? 'Approving…' : 'Confirm Approval'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="px-4 py-2 text-sm text-gray-600 hover:underline">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // reject mode
  return (
    <form onSubmit={onReject} className="space-y-4" noValidate>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
        <textarea
          rows={3}
          {...rejectForm.register('comments')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
          placeholder="Explain why this application is being rejected…"
        />
        {rejectForm.formState.errors.comments && (
          <p className="mt-1 text-xs text-red-600">{rejectForm.formState.errors.comments.message}</p>
        )}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={rejectForm.formState.isSubmitting}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {rejectForm.formState.isSubmitting ? 'Rejecting…' : 'Confirm Rejection'}
        </button>
        <button type="button" onClick={() => setMode('idle')} className="px-4 py-2 text-sm text-gray-600 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
