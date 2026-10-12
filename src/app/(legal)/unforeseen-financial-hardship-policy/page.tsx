import LegalArticle, { legalMetadata } from '../_components/LegalArticle';

const SLUG = 'unforeseen-financial-hardship-policy';

export const metadata = legalMetadata(SLUG);

export default function UnforeseenFinancialHardshipPolicyPage() {
  return (
    <LegalArticle
      slug={SLUG}
      lead="Life can sometimes take unexpected turns, and these events may affect your ability to keep up with loan repayments. We encourage you to reach out to us early."
    >
      <p>
        At TerePay, we encourage you to reach out to us early if you are experiencing, or expect to
        experience, unforeseen hardship or other financial difficulty.
      </p>

      <h2>Examples of situations that may lead to financial difficulty</h2>
      <p>Examples of situations that may lead to unforeseen hardship or other types of financial difficulty include:</p>
      <ul>
        <li>Injury or illness</li>
        <li>Loss of employment or reduced income</li>
        <li>Relationship changes (divorce or separation)</li>
        <li>Pregnancy or new family responsibilities</li>
        <li>Natural disasters affecting your home or income</li>
        <li>Ongoing medical treatment or health challenges</li>
        <li>Other unforeseen events that impact your finances</li>
      </ul>
      <p>
        If any of these apply to you, please contact us as soon as possible. We can consider options to
        support you through this period.
      </p>
      <p>
        &ldquo;Unforeseen hardship&rdquo; is a type of financial difficulty. We explain what &ldquo;unforeseen
        hardship&rdquo; means below and your rights in that situation. After that we explain some other types of
        financial difficulty and what we may be able to do if you experience such financial difficulty.
      </p>

      <h2>What to do if you suffer unforeseen hardship</h2>
      <p>
        If you are unable reasonably to keep up your payments or other obligations because of illness, injury,
        loss of employment, the end of a relationship, or other reasonable cause, you may be able to apply to
        us for a hardship variation. In some circumstances{' '}
        <a
          href="https://www.legislation.govt.nz/act/public/2003/0052/latest/DLM213121.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          listed in the Credit Contracts and Consumer Finance Act 2003
        </a>{' '}
        you are not entitled to make an application (but we might be able to consider that &mdash; see
        &ldquo;Other types of financial difficulty&rdquo; below).
      </p>
      <p>To apply for a hardship variation, you need to:</p>
      <ol>
        <li>make an application to us in writing;</li>
        <li>explain your reason(s) for the application; and</li>
        <li>
          request one of the following:
          <ul>
            <li>
              an extension of the term of the contract (which will reduce the amount of each payment due under
              the contract); or
            </li>
            <li>
              a postponement of the dates on which payments are due under the contract (specify the period for
              which you want this to apply); or
            </li>
            <li>both of the above; and</li>
          </ul>
        </li>
        <li>give the application to us.</li>
      </ol>
      <p>Do this as soon as possible. If you leave it for too long, we may not have to consider your application.</p>
      <p>You may give that notice in the following ways:</p>
      <ul>
        <li>deliver it to our address specified in our Disclosure Statement; or</li>
        <li>post it to our address specified in our Disclosure Statement; or</li>
        <li>email it to our email address specified in our Disclosure Statement.</li>
      </ul>

      <h2>What happens next?</h2>
      <p>We may ask for further information and supporting documents such as ACC letters or medical certificates.</p>
      <p>
        Once we review your request we will let you know whether we agree to make a hardship variation. If we
        agree to make a variation we&rsquo;ll send you a document to review and sign before any changes are made.
      </p>
      <p>Until changes are confirmed, please continue making payments where you can.</p>

      <h2>Other types of financial difficulty</h2>
      <p>
        If you are experiencing financial difficulty other than &ldquo;unforeseen hardship&rdquo; (above) or if you
        are not eligible to make a hardship application, we may be able to assist you in ways that are fair
        and reasonable to both us and you. Examples of situations that may lead to financial difficulty are
        above. In those situations you may miss, or be at risk of missing, making payments to us on the date
        for payment.
      </p>
      <p>
        You can contact us at any time about a financial difficulty or possible financial difficulty. We may
        request information about that from you such as bank statements, payslips, or other proof of income.
        Once we have enough information we will consider your situation and whether to help you. That may
        include extending the loan term (length), extending payment dates, waiving fees, or assisting you to
        get help from professionals such as budget advisers.
      </p>

      <h2>Getting advice</h2>
      <p>If you&rsquo;re facing financial difficulties, free support may be available through MoneyTalks.</p>
      <ul>
        <li>
          Call <a href="tel:0800345123">0800 345 123</a>
        </li>
        <li>
          Visit{' '}
          <a href="https://moneytalks.co.nz" target="_blank" rel="noopener noreferrer">
            moneytalks.co.nz
          </a>
        </li>
      </ul>
      <p>There are other services that also provide support.</p>
    </LegalArticle>
  );
}
