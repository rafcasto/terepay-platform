'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

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

const inputCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong placeholder:text-[var(--text-disabled)]';
const labelCls = 'block text-sm font-semibold text-ink-strong mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger-text font-medium';

interface Props {
  /** Formatted display address to show in the search box on initial load (from profile pre-population). */
  initialDisplayAddress?: string;
}

export default function AddressAutocomplete({ initialDisplayAddress }: Props) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.personalInfo;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);

  // Each Autocomplete→Details pair shares a session token to count as one billable event
  const sessionToken = useRef(crypto.randomUUID());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useRef(`address-listbox-${Math.random().toString(36).slice(2)}`).current;

  // When a pre-populated address arrives (after profile fetch), show it in the search box
  useEffect(() => {
    if (initialDisplayAddress && !hasTyped) {
      setQuery(initialDisplayAddress);
    }
  }, [initialDisplayAddress, hasTyped]);

  // Close dropdown when clicking outside
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

  const handleInputChange = (value: string) => {
    setQuery(value);
    setHasTyped(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
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
        setValue('personalInfo.address', data.address.street, { shouldValidate: true });
        setValue('personalInfo.suburb', data.address.suburb, { shouldValidate: false });
        setValue('personalInfo.city', data.address.city, { shouldValidate: true });
        setValue('personalInfo.postCode', data.address.postCode, { shouldValidate: true });
        setQuery(data.address.formatted || suggestion.description);
      }
    } catch {
      // Fallback: let user manually correct the sub-fields
    } finally {
      setIsLoading(false);
      // Rotate session token so the next search/select pair is billed separately
      sessionToken.current = crypto.randomUUID();
    }
  };

  const switchToManual = () => {
    setIsManual(true);
    setShowDropdown(false);
  };

  const switchToSearch = () => {
    setIsManual(false);
    setQuery('');
    setValue('personalInfo.address', '', { shouldValidate: false });
    setValue('personalInfo.suburb', '', { shouldValidate: false });
    setValue('personalInfo.city', '', { shouldValidate: false });
    setValue('personalInfo.postCode', '', { shouldValidate: false });
    sessionToken.current = crypto.randomUUID();
  };

  return (
    <div className="space-y-4">
      {/* ── Autocomplete search box ── */}
      {!isManual && (
        <div ref={containerRef} className="relative">
          <label className={labelCls}>
            Residential Address <span className="text-danger-text">*</span>
          </label>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] pointer-events-none">
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
                <svg className="h-4 w-4 animate-spin text-[var(--text-disabled)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showDropdown && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-50 mt-1 w-full bg-surface-card border border-border-default rounded-lg shadow-lg overflow-hidden"
            >
              {suggestions.length === 0 ? (
                <li className="px-4 py-3 text-sm text-[var(--text-muted)]">
                  No results found.{' '}
                  <button
                    type="button"
                    onClick={switchToManual}
                    className="text-brand-text underline hover:no-underline"
                  >
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
                    className="px-4 py-2.5 text-sm text-ink-strong hover:bg-brand-soft cursor-pointer border-b border-border-subtle last:border-0"
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

      {/* ── Confirmed / manual sub-fields ── */}
      <div className="space-y-4">
        {/* Street address */}
        <div>
          <label className={labelCls}>
            Street Address <span className="text-danger-text">*</span>
          </label>
          <input
            {...register('personalInfo.address')}
            className={inputCls}
            placeholder="123 Queen Street"
            readOnly={!isManual && !!query}
          />
          {e?.address && <p className={errorCls}>{e.address.message}</p>}
        </div>

        {/* Suburb + City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Suburb</label>
            <input
              {...register('personalInfo.suburb')}
              className={inputCls}
              placeholder="Auckland CBD"
              readOnly={!isManual && !!query}
            />
          </div>
          <div>
            <label className={labelCls}>
              City / Town <span className="text-danger-text">*</span>
            </label>
            <input
              {...register('personalInfo.city')}
              className={inputCls}
              placeholder="Auckland"
              readOnly={!isManual && !!query}
            />
            {e?.city && <p className={errorCls}>{e.city.message}</p>}
          </div>
        </div>

        {/* Post Code */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Post Code <span className="text-danger-text">*</span>
            </label>
            <input
              {...register('personalInfo.postCode')}
              className={inputCls}
              placeholder="1010"
              readOnly={!isManual && !!query}
            />
            {e?.postCode && <p className={errorCls}>{e.postCode.message}</p>}
          </div>
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="text-xs">
        {isManual ? (
          <button
            type="button"
            onClick={switchToSearch}
            className="text-brand-text hover:underline"
          >
            Search for address instead
          </button>
        ) : (
          <button
            type="button"
            onClick={switchToManual}
            className="text-[var(--text-muted)] hover:text-ink-strong hover:underline"
          >
            Can&apos;t find your address? Enter manually
          </button>
        )}
      </div>
    </div>
  );
}
