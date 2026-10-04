import { describe, expect, it } from 'vitest';
import { creditSummarySchema } from './schemas';

const valid = { reportDate: '2026-09-18', score: 643, defaults: 0, enquiries: 2 };

describe('creditSummarySchema', () => {
  it('accepts a summary with or without utilisation', () => {
    expect(creditSummarySchema.parse(valid)).toEqual(valid);
    expect(creditSummarySchema.parse({ ...valid, utilisation: 38.5 }).utilisation).toBe(38.5);
  });

  it('rejects scores outside the Centrix 0–1000 range and non-integers', () => {
    expect(creditSummarySchema.safeParse({ ...valid, score: 1001 }).success).toBe(false);
    expect(creditSummarySchema.safeParse({ ...valid, score: -1 }).success).toBe(false);
    expect(creditSummarySchema.safeParse({ ...valid, score: 640.5 }).success).toBe(false);
  });

  it('requires score, defaults and enquiries', () => {
    for (const key of ['score', 'defaults', 'enquiries'] as const) {
      expect(creditSummarySchema.safeParse({ ...valid, [key]: undefined }).success).toBe(false);
    }
  });

  it('rejects malformed, impossible and future report dates', () => {
    expect(creditSummarySchema.safeParse({ ...valid, reportDate: '18/09/2026' }).success).toBe(false);
    expect(creditSummarySchema.safeParse({ ...valid, reportDate: '2026-13-40' }).success).toBe(false);
    expect(creditSummarySchema.safeParse({ ...valid, reportDate: '2999-01-01' }).success).toBe(false);
  });
});
