'use client';

import { useState, useEffect } from 'react';
import type { AdminLenderView } from '@/types/admin';

type FormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

const EMPTY_FORM: FormState = { email: '', password: '', firstName: '', lastName: '' };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminLenderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal
  const [editUser, setEditUser] = useState<AdminLenderView | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', status: 'active' as AdminLenderView['status'] });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/users')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error?.message ?? `Server error ${r.status}`);
        return json;
      })
      .then((json) => setUsers(json.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to create user');
      }
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setSuccess('Lender account created.');
      setTimeout(() => setSuccess(null), 4000);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user: AdminLenderView) => {
    setEditUser(user);
    setEditForm({ firstName: user.firstName, lastName: user.lastName, status: user.status });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/users/${editUser.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to update user');
      }
      setEditUser(null);
      setSuccess('User updated.');
      setTimeout(() => setSuccess(null), 4000);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: AdminLenderView['status']) => {
    const styles: Record<AdminLenderView['status'], string> = {
      active: 'bg-green-100 text-green-700',
      suspended: 'bg-amber-100 text-amber-700',
      inactive: 'bg-slate-100 text-slate-500',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#16263B]">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage lender accounts.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(true); setCreateError(null); setForm(EMPTY_FORM); }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Lender
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
      )}

      <div className="tp-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="h-6 w-6 animate-spin text-[#F08000]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No lender accounts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name', 'Email', 'Status', 'Profile', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1C2A3A]">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.profileComplete ? 'text-green-600' : 'text-slate-400'}`}>
                      {u.profileComplete ? 'Complete' : 'Incomplete'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-tabular">
                    {u.createdAt
                      ? new Date(u.createdAt as unknown as number).toLocaleDateString('en-NZ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="text-xs font-medium text-[#B45600] hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-display text-lg font-semibold text-[#16263B] mb-5">Create Lender Account</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First name</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last name</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Temporary password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 8 characters. Share with the lender securely.</p>
              </div>
              {createError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {createError}
                </p>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60"
                >
                  {creating && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-display text-lg font-semibold text-[#16263B] mb-1">Edit Lender</h2>
            <p className="text-sm text-slate-500 mb-5">{editUser.email}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as AdminLenderView['status'] }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
                {editForm.status !== 'active' && (
                  <p className="text-xs text-amber-600 mt-1">
                    {editForm.status === 'suspended'
                      ? 'User sessions will be revoked. User can be reactivated.'
                      : 'User will be disabled in Firebase Auth.'}
                  </p>
                )}
              </div>
              {editError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {editError}
                </p>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60"
                >
                  {saving && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
