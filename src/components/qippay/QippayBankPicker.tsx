import { FormField, Icons } from '@/components/ui';
import { QIPPAY_BANK_SELECTION, sortBanksAlphabetically } from '@/lib/qippay/brand';

export type QippayBank = { id: string; name: string; logoUrl?: string };

type Props = {
  banks: readonly QippayBank[];
  /** Currently selected bank id. Start with '' — no bank may be pre-selected (§6). */
  selectedId: string;
  onSelect: (id: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  disabled?: boolean;
  /** Prefix for element ids when more than one picker is on a page. */
  idPrefix?: string;
};

/**
 * Bank selection screen per Merchant Brand Guidelines §6 — primary "vertical"
 * layout: mobile number field above the banks, "Choose your bank to pay
 * securely" guidance, then same-size bank logos in alphabetical order with no
 * bank enlarged, highlighted or pre-selected. Select-and-confirm pattern: the
 * parent renders the "Continue to [Bank]" button.
 */
export function QippayBankPicker({
  banks,
  selectedId,
  onSelect,
  phone,
  onPhoneChange,
  disabled,
  idPrefix = 'qippay',
}: Props) {
  const sorted = sortBanksAlphabetically(banks);
  const { logoWidthPx, logoHeightPx } = QIPPAY_BANK_SELECTION;
  const phoneId = `${idPrefix}-mobile`;
  const helperId = `${phoneId}-helper`;
  const groupLabelId = `${idPrefix}-banks-label`;

  return (
    <div className="space-y-4">
      <div>
        <FormField
          id={phoneId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label={QIPPAY_BANK_SELECTION.mobileLabel}
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          disabled={disabled}
          placeholder="021 123 4567"
          aria-describedby={helperId}
        />
        <p id={helperId} className="mt-1.5 text-xs text-muted">
          {QIPPAY_BANK_SELECTION.mobileHelper}
        </p>
      </div>

      <div>
        <p id={groupLabelId} className="mb-2 text-sm font-semibold text-ink-strong">
          {QIPPAY_BANK_SELECTION.guidance}
        </p>
        <div role="radiogroup" aria-labelledby={groupLabelId} className="flex flex-col gap-2">
          {sorted.map((bank) => {
            const selected = bank.id === selectedId;
            return (
              <button
                key={bank.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onSelect(bank.id)}
                className={
                  'flex w-full items-center gap-3 rounded-xl border bg-surface-card p-2.5 text-left transition-colors duration-150 ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ' +
                  'disabled:cursor-not-allowed disabled:opacity-50 ' +
                  (selected
                    ? 'border-[var(--orange-700)] ring-1 ring-[var(--orange-700)]'
                    : 'border-border-default hover:border-border-strong')
                }
              >
                <span
                  className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-card"
                  style={{ width: logoWidthPx, height: logoHeightPx }}
                >
                  {bank.logoUrl ? (
                    // Bank logo SVGs come from the Qippay API exactly as supplied
                    // (clear space built in). Arbitrary external hosts, so a plain
                    // <img> rather than next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bank.logoUrl}
                      alt=""
                      width={logoWidthPx}
                      height={logoHeightPx}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-full w-full items-center justify-center rounded-md bg-surface-sunken text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      {bank.name.slice(0, 3)}
                    </span>
                  )}
                </span>
                <span className="flex-1 text-[15px] font-medium text-ink-strong">{bank.name}</span>
                {selected ? (
                  <Icons.CheckCircle size={20} className="shrink-0 text-[var(--orange-700)]" />
                ) : (
                  <Icons.ChevronRight size={20} className="shrink-0 text-muted" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
