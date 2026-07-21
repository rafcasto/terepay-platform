import Decimal from 'decimal.js';

/**
 * Effective-dated collections configuration (FR-1, CC-6).
 *
 * Rates, fees and grace periods are keyed by effective date so a change applies
 * only to loans/periods on or after its effective date, and any historical
 * statement remains reproducible from the config in force at that date. Never
 * hard-code these literals in the engine — read them from here.
 *
 * Seed values are the current TerePay Consumer Credit Contract figures
 * (Collection Agent/CLAUDE.md fee schedule + loan structure).
 */

export type InterestOnFeesPolicy = 'OFF' | 'ON';

export interface CollectionsConfig {
  /** ISO date this config version takes effect (inclusive). */
  effectiveDate: string;
  /** Fixed annual interest rate (0.49 = 49%). */
  annualRate: Decimal;
  /** Daily interest rate = annualRate / 365. Full precision, never pre-rounded. */
  dailyRate: Decimal;
  /** Days between fortnightly interest charges (compounding cadence). */
  chargeIntervalDays: number;
  /** On-time total interest as a fraction of principal — SANITY CHECK ONLY (AC-3). */
  onTimeInterestFraction: Decimal;
  fees: {
    latePayment: Decimal;
    paymentDefault: Decimal;
    establishment: Decimal;
    additionalLoan: Decimal;
    earlyFullRepayment: Decimal;
  };
  grace: {
    /** Late Payment Fee charged on this day past due. */
    latePaymentDays: number;
    /** Payment Default Fee charged on this day past due. */
    paymentDefaultDays: number;
  };
  /**
   * Default interest-on-fees policy. Compliance-signed default is OFF: fees sit
   * in a separate non-interest-bearing bucket (FR-13). The per-loan effective
   * policy is still read from PolicySetting at run time; this is only the seed.
   */
  interestOnFeesPolicyDefault: InterestOnFeesPolicy;
}

/**
 * Config versions, newest first. `configForDate` selects the version in force.
 * Add a new entry (never edit an old one) to change rates/fees going forward.
 */
const CONFIG_VERSIONS: readonly CollectionsConfig[] = [
  {
    effectiveDate: '2026-01-01',
    annualRate: new Decimal('0.49'),
    dailyRate: new Decimal('0.49').div(365), // 0.00134246575...
    chargeIntervalDays: 14,
    onTimeInterestFraction: new Decimal('0.047'),
    fees: {
      latePayment: new Decimal('10'),
      paymentDefault: new Decimal('25'),
      establishment: new Decimal('50'),
      additionalLoan: new Decimal('20'),
      earlyFullRepayment: new Decimal('25'),
    },
    grace: {
      latePaymentDays: 3,
      paymentDefaultDays: 7,
    },
    // Compliance sign-off 2026-07: interest-on-fees is OFF.
    interestOnFeesPolicyDefault: 'OFF',
  },
];

/** The single timezone all "daily" accrual and grace day-counts use (NFR-2). */
export const COLLECTIONS_TIMEZONE = 'Pacific/Auckland' as const;

/** Return the config version in force on the given ISO date (YYYY-MM-DD). */
export function configForDate(isoDate: string): CollectionsConfig {
  const match = CONFIG_VERSIONS.find((c) => c.effectiveDate <= isoDate);
  if (!match) {
    throw new Error(
      `No collections config effective on or before ${isoDate}; earliest is ${
        CONFIG_VERSIONS[CONFIG_VERSIONS.length - 1]?.effectiveDate
      }`,
    );
  }
  return match;
}

/** Static footer / compliance identity for statements (SG-5). Config, not literals. */
export const STATEMENT_IDENTITY = {
  bankName: 'BNZ',
  accountName: 'TerePay Neophile Ltd',
  accountNumber: '02-0108-0900334-000',
  fsp: 'FSP1007414',
  nzbn: '9429052055232',
  signOffName: 'Kenneth Gustilo',
  signOffTitle: 'Managing Director',
  contactEmail: 'info@terepay.com',
} as const;
