'use client';

import { createContext, useContext } from 'react';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

/**
 * What the apply flow knows about a returning customer.
 *
 * - `isRepeat` — the applicant is an existing customer (the same
 *   `isExistingCustomer` flag that sets their application fee). Repeat
 *   customers are not asked for references.
 * - `previous` — employment and bank details from their most recent submitted
 *   application, offered back so they don't re-enter what hasn't changed.
 *   Either may be missing (e.g. a customer who first borrowed offline).
 * - `referenceRequired` — a new customer must give one complete reference.
 *
 * The defaults describe a new applicant with nothing to carry over, which is
 * also what the lender's on-behalf form (no provider) gets.
 */
export interface RepeatBorrowerState {
  isRepeat: boolean;
  referenceRequired: boolean;
  previous: {
    employment?: TerepayApplicationInput['employment'];
    bankDetails?: TerepayApplicationInput['bankDetails'];
  };
}

const DEFAULT_STATE: RepeatBorrowerState = { isRepeat: false, referenceRequired: false, previous: {} };

const RepeatBorrowerContext = createContext<RepeatBorrowerState>(DEFAULT_STATE);

export const RepeatBorrowerProvider = RepeatBorrowerContext.Provider;

export function useRepeatBorrower(): RepeatBorrowerState {
  return useContext(RepeatBorrowerContext);
}
