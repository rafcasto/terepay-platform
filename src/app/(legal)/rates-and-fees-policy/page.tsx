import LegalArticle, { legalMetadata } from '../_components/LegalArticle';

const SLUG = 'rates-and-fees-policy';

export const metadata = legalMetadata(SLUG);

export default function RatesAndFeesPolicyPage() {
  return (
    <LegalArticle slug={SLUG} lead="Credit, default and enforcement fees and charges.">
      <h2>Establishment and application fees</h2>
      <ul>
        <li>
          New Customer Establishment Fee: <span className="tp-num">$50.00</span> (
          <strong>for new customers only</strong>)
        </li>
        <li>
          Additional Loan Application Fee: <span className="tp-num">$20.00</span> (for any additional loan
          taken out after your first loan)
        </li>
      </ul>
      <p>These fees may be deducted from the loan amount, with the borrower&rsquo;s consent.</p>

      <h2>Early repayment fee</h2>
      <ul>
        <li>
          Prepayment Fee: <span className="tp-num">$25.00</span> (when the loan is repaid early in full, to
          cover administrative costs)
        </li>
      </ul>

      <h2>Default fees</h2>
      <ul>
        <li>
          Late Payment Fee: <span className="tp-num">$10.00</span>. This is applied for each missed payment
          (only after a 3-day grace period), so late fees can be up to a maximum of{' '}
          <span className="tp-num">$40.00</span>.
        </li>
        <li>
          Payment Default Fee: <span className="tp-num">$25.00</span> (applied only after a 7-day grace
          period), in addition to the Late Payment Fee. This fee is only charged once even if there are
          further late payments.
        </li>
      </ul>

      <h2>Additional cost recovery</h2>
      <p>
        The loan agreement also allows us to recover reasonable costs related to protecting or enforcing the
        agreement, including:
      </p>
      <ul>
        <li>Legal costs</li>
        <li>Court filing fees</li>
        <li>Collection agency costs</li>
      </ul>
      <p>
        These fees and costs must be paid for by the borrower. They will be added to the loan and must be paid
        immediately.
      </p>
      <p>All fees and costs are in New Zealand dollars and are separate from the loan&rsquo;s interest charges.</p>
    </LegalArticle>
  );
}
