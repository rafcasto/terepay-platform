'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Suggestion {
  placeId: string;
  description: string;
}

interface ParsedAddress {
  street: string;
  suburb: string;
  city: string;
  postCode: string;
  country: string;
  formatted: string;
}

export interface AddressValue {
  address: string;
  suburb: string;
  city: string;
  postCode: string;
  country: string;
}

interface Props {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  errors?: Partial<Record<keyof AddressValue, string>>;
}

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:outline-none transition-colors bg-white';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'mt-1 text-xs text-red-600';

/**
 * Standalone address autocomplete for the KYC profile step.
 * Does not depend on react-hook-form context — uses controlled props instead.
 */
export default function KycAddressAutocomplete({ value, onChange, errors }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);

  const sessionToken = useRef(crypto.randomUUID());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `kyc-address-listbox`;

  useEffect(() => {
    if (value.address && !hasTyped) {
      setQuery(value.address);
    }
  }, [value.address, hasTyped]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    setIsLoading(true);
    try {
      const token = sessionToken.current;
      const res = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}&sessiontoken=${token}`,
      );
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setSuggestions(data.predictions ?? []);
      setShowDropdown(true);
      setApiUnavailable(false);
    } catch {
      setApiUnavailable(true);
      setIsManual(true);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (v: string) => {
    setQuery(v);
    setHasTyped(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    setShowDropdown(false);
    setQuery(suggestion.description);
    setIsLoading(true);
    try {
      const token = sessionToken.current;
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}&sessiontoken=${token}`,
      );
      if (!res.ok) throw new Error('Details API error');
      const data: { address: ParsedAddress | null } = await res.json();
      if (data.address) {
        onChange({
          address: data.address.street,
          suburb: data.address.suburb,
          city: data.address.city,
          postCode: data.address.postCode,
          country: data.address.country || 'New Zealand',
        });
        setQuery(data.address.formatted || suggestion.description);
      }
    } catch {
      // Fallback: let user edit sub-fields manually
    } finally {
      setIsLoading(false);
      sessionToken.current = crypto.randomUUID();
    }
  };

  const update = (field: keyof AddressValue, v: string) => {
    onChange({ ...value, [field]: v });
  };

  return (
    <div className="space-y-4">
      {/* ── Autocomplete search ──────────────────────────────────────────── */}
      {!isManual && (
        <div ref={containerRef} className="relative">
          <label className={labelCls}>
            Residential Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder="Start typing your address…"
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={showDropdown}
              role="combobox"
              className={`${inputCls} pl-9 pr-8`}
            />
            {isLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            )}
          </div>

          {showDropdown && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
            >
              {suggestions.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500">
                  No results found.{' '}
                  <button type="button" onClick={() => setIsManual(true)} className="text-[#F5A523] underline">
                    Enter manually
                  </button>
                </li>
              ) : (
                suggestions.map((s) => (
                  <li
                    key={s.placeId}
                    role="option"
                    aria-selected={false}
                    onMouseDown={() => handleSelect(s)}
                    className="px-4 py-2.5 text-sm text-gray-800 hover:bg-amber-50 cursor-pointer border-b border-gray-100 last:border-0"
                  >
                    <span className="block truncate">{s.description}</span>
                  </li>
                ))
              )}
            </ul>
          )}

          {apiUnavailable && (
            <p className="mt-1 text-xs text-amber-600">
              Address lookup unavailable — please enter your address manually.
            </p>
          )}
        </div>
      )}

      {/* ── Sub-fields ────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <label className={labelCls}>
            Street Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.address}
            onChange={(e) => update('address', e.target.value)}
            className={inputCls}
            placeholder="123 Queen Street"
            readOnly={!isManual && !!query}
          />
          {errors?.address && <p className={errorCls}>{errors.address}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Suburb</label>
            <input
              type="text"
              value={value.suburb}
              onChange={(e) => update('suburb', e.target.value)}
              className={inputCls}
              placeholder="Auckland CBD"
              readOnly={!isManual && !!query}
            />
          </div>
          <div>
            <label className={labelCls}>
              City / Town <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.city}
              onChange={(e) => update('city', e.target.value)}
              className={inputCls}
              placeholder="Auckland"
              readOnly={!isManual && !!query}
            />
            {errors?.city && <p className={errorCls}>{errors.city}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Post Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.postCode}
              onChange={(e) => update('postCode', e.target.value)}
              className={inputCls}
              placeholder="1010"
              readOnly={!isManual && !!query}
            />
            {errors?.postCode && <p className={errorCls}>{errors.postCode}</p>}
          </div>
        </div>
      </div>

      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      <div className="text-xs">
        {isManual ? (
          <button
            type="button"
            onClick={() => {
              setIsManual(false);
              setQuery('');
              onChange({ address: '', suburb: '', city: '', postCode: '', country: 'New Zealand' });
              sessionToken.current = crypto.randomUUID();
            }}
            className="text-[#F5A523] hover:underline"
          >
            Search for address instead
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsManual(true)}
            className="text-[#F5A523] hover:underline"
          >
            Can&apos;t find your address? Enter manually
          </button>
        )}
      </div>
    </div>
  );
}
