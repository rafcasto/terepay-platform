'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import CustomerStatusToggle from './CustomerStatusToggle';
import CustomerEditPanel from './CustomerEditPanel';
import type { MergedCustomer } from '../page';

type SortColumn = 'name' | 'createdAt' | 'customerId';
type SortDir = 'asc' | 'desc';

const fmtDate = (ts?: string | null) => {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(new Date(ts));
};

function SortIcon({ column, active, dir }: { column: string; active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="ml-1 h-3 w-3 text-gray-300 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return dir === 'asc' ? (
    <svg className="ml-1 h-3 w-3 text-[#F5A523] inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="ml-1 h-3 w-3 text-[#F5A523] inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function CustomersTable({ initialCustomers }: { initialCustomers: MergedCustomer[] }) {
  const [customers, setCustomers] = useState<MergedCustomer[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'online' | 'offline'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'existing'>('all');
  const [filterLinkStatus, setFilterLinkStatus] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedCustomer, setSelectedCustomer] = useState<MergedCustomer | null>(null);

  const isFiltered =
    searchQuery !== '' ||
    filterType !== 'all' ||
    filterStatus !== 'all' ||
    filterLinkStatus !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterStatus('all');
    setFilterLinkStatus('all');
  };

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  };

  const handleEditSuccess = (id: string, updated: Partial<MergedCustomer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    );
  };

  const displayed = useMemo(() => {
    let list = [...customers];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        return (
          fullName.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.customerId ?? '').toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      });
    }

    // Filters
    if (filterType !== 'all') {
      list = list.filter((c) => c.type === filterType);
    }
    if (filterStatus !== 'all') {
      list = list.filter((c) =>
        filterStatus === 'existing' ? c.isExistingCustomer : !c.isExistingCustomer,
      );
    }
    if (filterLinkStatus !== 'all') {
      list = list.filter(
        (c) => c.type === 'offline' && c.linkStatus === filterLinkStatus,
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'name') {
        cmp = `${a.firstName} ${a.lastName}`
          .toLowerCase()
          .localeCompare(`${b.firstName} ${b.lastName}`.toLowerCase());
      } else if (sortColumn === 'createdAt') {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        cmp = aTime - bTime;
      } else if (sortColumn === 'customerId') {
        cmp = (a.customerId ?? a.id).localeCompare(b.customerId ?? b.id);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [customers, searchQuery, filterType, filterStatus, filterLinkStatus, sortColumn, sortDir]);

  if (customers.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <svg className="mx-auto h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 10-8 0 4 4 0 008 0zm6 4a4 4 0 10-8 0 4 4 0 008 0z" />
        </svg>
        <p className="text-sm font-medium text-gray-500">No customers yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Customers who register online or are added manually will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email or ID…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
          >
            <option value="all">All Sources</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="existing">Existing</option>
          </select>

          <select
            value={filterLinkStatus}
            onChange={(e) => setFilterLinkStatus(e.target.value as typeof filterLinkStatus)}
            className="rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
          >
            <option value="all">All Link Statuses</option>
            <option value="linked">Linked</option>
            <option value="unlinked">Unlinked</option>
          </select>

          {isFiltered && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Result count */}
        <span className="text-xs text-gray-400 sm:ml-auto whitespace-nowrap">
          {displayed.length} of {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm font-medium text-gray-500">No customers match your filters</p>
          <button
            onClick={clearFilters}
            className="mt-2 text-xs text-[#F5A523] hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  {/* Sortable: Customer ID */}
                  <th
                    className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('customerId')}
                  >
                    Customer ID
                    <SortIcon column="customerId" active={sortColumn === 'customerId'} dir={sortDir} />
                  </th>
                  {/* Sortable: Name */}
                  <th
                    className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('name')}
                  >
                    Name
                    <SortIcon column="name" active={sortColumn === 'name'} dir={sortDir} />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Source</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Link Status</th>
                  {/* Sortable: Created */}
                  <th
                    className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('createdAt')}
                  >
                    Created
                    <SortIcon column="createdAt" active={sortColumn === 'createdAt'} dir={sortDir} />
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map((c) => (
                  <tr key={`${c.type}-${c.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {c.customerId ? (
                        <span className="font-mono font-semibold text-[#E08B00]">{c.customerId}</span>
                      ) : (
                        <span className="font-mono text-gray-400 text-xs">{c.id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.type === 'online' ? 'info' : 'default'}>
                        {c.type === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <CustomerStatusToggle
                        customerId={c.id}
                        isExistingCustomer={c.isExistingCustomer}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {c.type === 'offline' && c.linkStatus ? (
                        <Badge variant={c.linkStatus === 'linked' ? 'success' : 'warning'}>
                          {c.linkStatus === 'linked' ? 'Linked' : 'Unlinked'}
                        </Badge>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="text-xs text-gray-500 font-medium hover:text-gray-800 hover:underline"
                        >
                          Edit
                        </button>
                        <Link
                          href={
                            c.type === 'offline'
                              ? `/lender/applications/new?offlineCustomerId=${c.id}`
                              : `/lender/applications/new?applicantId=${c.id}`
                          }
                          className="text-xs text-[#F5A523] font-medium hover:underline"
                        >
                          New Application
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {displayed.map((c) => (
              <div key={`${c.type}-${c.id}`} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    {c.customerId ? (
                      <p className="font-mono font-bold text-[#E08B00] text-sm">{c.customerId}</p>
                    ) : (
                      <p className="font-mono text-gray-400 text-xs">{c.id.slice(0, 8)}…</p>
                    )}
                    <p className="font-medium text-gray-900 text-sm">{c.firstName} {c.lastName}</p>
                  </div>
                  <Badge variant={c.type === 'online' ? 'info' : 'default'}>
                    {c.type === 'online' ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mb-3">{c.email}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CustomerStatusToggle
                      customerId={c.id}
                      isExistingCustomer={c.isExistingCustomer}
                    />
                    {c.type === 'offline' && c.linkStatus && (
                      <Badge variant={c.linkStatus === 'linked' ? 'success' : 'warning'}>
                        {c.linkStatus === 'linked' ? 'Linked' : 'Unlinked'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedCustomer(c)}
                      className="text-xs text-gray-500 font-medium hover:underline"
                    >
                      Edit
                    </button>
                    <Link
                      href={
                        c.type === 'offline'
                          ? `/lender/applications/new?offlineCustomerId=${c.id}`
                          : `/lender/applications/new?applicantId=${c.id}`
                      }
                      className="text-xs text-[#F5A523] font-medium"
                    >
                      New Application →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CustomerEditPanel
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onSuccess={(id, updated) => {
          handleEditSuccess(id, updated);
          setSelectedCustomer(null);
        }}
      />
    </>
  );
}
