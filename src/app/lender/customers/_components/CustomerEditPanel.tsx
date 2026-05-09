'use client';

import { useEffect, useRef, useState } from 'react';
import Badge from '@/components/shared/Badge';
import type { MergedCustomer } from '../page';

type Props = {
  customer: MergedCustomer | null;
  onClose: () => void;
  onSuccess: (id: string, updated: Partial<MergedCustomer>) => void;
};

export default function CustomerEditPanel({ customer, onClose, onSuccess }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Populate form when customer changes
  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setEmail(customer.email ?? '');
      setPhone('');
      setNotes('');
      setError(null);
      // Focus first input after the panel animates in
      const t = setTimeout(() => firstInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [customer]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isOffline = customer?.type === 'offline';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setLoading(true);
    setError(null);

    const body: Record<string, string> = { firstName, lastName };
    if (phone.trim()) body.phone = phone.trim();
    if (isOffline) {
      if (notes.trim()) body.notes = notes.trim();
      if (email.trim()) body.email = email.trim();
    }

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to update customer');
      }

      const updated: Partial<MergedCustomer> = { firstName, lastName };
      if (phone.trim()) updated.email = customer.email; // preserve email; phone stored server-side
      if (isOffline && email.trim()) updated.email = email.trim();

      onSuccess(customer.id, updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          customer ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit customer"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          customer ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              {customer ? `${customer.firstName} ${customer.lastName}` : 'Edit Customer'}
            </h2>
            {customer && (
              <Badge variant={customer.type === 'online' ? 'info' : 'default'}>
                {customer.type === 'online' ? 'Online' : 'Offline'}
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close panel"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 px-6 py-6">
            {customer?.customerId && (
              <p className="text-xs text-gray-400">
                Customer ID:{' '}
                <span className="font-mono font-semibold text-[#E08B00]">{customer.customerId}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Last name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
              </div>
            </div>

            {/* Email — offline only */}
            {isOffline && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Used for account linking when the customer registers online.
                </p>
              </div>
            )}

            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={customer?.type === 'online' ? 'Leave blank to keep current' : ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
              />
              {customer?.type === 'online' && (
                <p className="mt-1 text-xs text-gray-400">Leave blank to keep the existing number.</p>
              )}
            </div>

            {/* Notes — offline only */}
            {isOffline && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523] resize-none"
                />
                <p className="mt-1 text-xs text-gray-400 text-right">{notes.length}/1000</p>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
