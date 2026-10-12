import Link from 'next/link';
import LegalArticle, { legalMetadata } from '../_components/LegalArticle';

const SLUG = 'terms-and-conditions';

export const metadata = legalMetadata(SLUG);

/* ------------------------------------------------------------------------
 * Clause model. Numbers are explicit so cross-references in the text
 * (e.g. "clauses 8.2a or 9.1f", "clause 12.1") stay accurate.
 * ---------------------------------------------------------------------- */

interface SubClause {
  n: string;
  text: React.ReactNode;
  sub?: SubClause[];
}

interface Clause {
  n: string;
  text: React.ReactNode;
  sub?: SubClause[];
  /** Free-standing paragraph rendered after `sub` (e.g. "then we may…"). */
  after?: React.ReactNode;
  /** Sub-clauses rendered after `after`, continuing the same lettering. */
  subAfter?: SubClause[];
}

interface Section {
  n: string;
  title: string;
  clauses: Clause[];
}

const SECTIONS: Section[] = [
  {
    n: '1',
    title: 'Loan & access to the Loan',
    clauses: [
      { n: '1.1', text: 'You agree to borrow the Loan from us for the term (length) specified in the Disclosure Statement.' },
      {
        n: '1.2',
        text: 'The Loan Amount will be paid to your Nominated Bank Account on the Loan Access Date. However, we have the right to decline to provide the Loan, if you have not complied, or are currently not complying, with this Agreement.',
      },
      { n: '1.3', text: 'We will pay the Loan Amount to you in one amount unless we agree otherwise in writing.' },
    ],
  },
  {
    n: '2',
    title: 'Payments',
    clauses: [
      { n: '2.1', text: 'You must repay the Loan according to the Payment Schedule.' },
      {
        n: '2.2',
        text: 'You must pay all amounts payable under this Agreement without any set-off, deduction, withholding or claim (except as required by law). All of your payments must be made by electronic funds transfer to the bank account we notify to you from time-to-time. We will not accept payment made in any other way and we will return such payments to you as soon as reasonably possible.',
      },
      {
        n: '2.3',
        text: 'The Payment Schedule has been prepared on the following assumptions:',
        sub: [
          { n: 'a', text: 'that we will pay the entire Loan Amount to you on the Loan Access Date;' },
          {
            n: 'b',
            text: 'the only fees you have to pay are the “Establishment Fee” (if any) and the “Additional Loan Application Fee” (if any) specified in the Disclosure Statement;',
          },
          {
            n: 'c',
            text: 'that you will pay all amounts due under this Agreement on time and that you will comply with this Agreement at all times.',
          },
        ],
        after:
          'If your payments are late then the amounts you have to pay will be more than those specified in the Payment Schedule. We can decide to waive (agree not to charge) some or all of those additional amounts at our sole option.',
      },
      {
        n: '2.4',
        text: 'If we use our power under clauses 8.2a or 9.1f to require you to pay the entire Unpaid Balance, the Payment Schedule shall be adjusted so that the only remaining payment is a payment of the entire Unpaid Balance on the date that we use that power.',
      },
      {
        n: '2.5',
        text: 'We may, at our sole discretion, credit any payments (including any early payments) from you (other than a Full Prepayment) made under this Agreement to your Borrower Account in accordance with the Payment Schedule. Any payment made under this Agreement that we do not agree to credit in accordance with the Payment Schedule must be credited to your Borrower Account as soon as practicable after it is received. In this clause 2, “as soon as practicable” has the meaning given to it in section 46(2) of the CCCFA.',
      },
    ],
  },
  {
    n: '3',
    title: 'Interest & default fees',
    clauses: [
      {
        n: '3.1',
        text: 'You must pay interest on the Loan. Interest accrues at the Annual Interest Rate on the Unpaid Balance. Interest charges will be calculated and accrue each day by applying the applicable daily interest rate to that day’s Unpaid Daily Balance. The applicable daily interest rate is the Annual Interest Rate divided by 365. If your payments are late then the total interest charges will be higher. We can decide to waive (agree not to charge) some or all of those higher charges at our sole option.',
      },
      {
        n: '3.2',
        text: 'If you fail to pay an amount payable under this Agreement, you must pay the “Default Fees” as required by the Disclosure Statement.',
      },
      {
        n: '3.3',
        text: 'Interest charges will be debited to your Borrower Account fortnightly from the Loan Access Date and must be paid by you on the dates specified in the Payment Schedule.',
      },
    ],
  },
  {
    n: '4',
    title: 'Repaying the Loan early',
    clauses: [
      { n: '4.1', text: 'You may make a Full Prepayment at any time.' },
      {
        n: '4.2',
        text: 'You may make a part prepayment at any time. That is, you may make a payment before the relevant date for payment specified in the Payment Schedule. However, unless the prepayment is a Full Prepayment (see clauses 4.3 and 4.4) or we notify you otherwise, we will not credit (apply) the prepayment to your Borrower Account until the scheduled payment date. As a result you will not receive any interest savings for paying early.',
      },
      {
        n: '4.3',
        text: 'The amount required to make a Full Prepayment is the total of the following amounts:',
        sub: [
          { n: 'a', text: 'the Unpaid Balance at the time of the Full Prepayment; and' },
          {
            n: 'b',
            text: 'the “Early Payment Fee” specified in the Disclosure Statement to reasonably compensate us for any administrative costs incurred by us in relation to the Full Prepayment.',
          },
        ],
      },
      {
        n: '4.4',
        text: 'We must credit a Full Prepayment you make to your Borrower Account as soon as practicable after it is received. In this clause “as soon as practicable” has the meaning given to it in section 46(2) of the CCCFA.',
      },
    ],
  },
  {
    n: '5',
    title: 'Fees and charges',
    clauses: [
      {
        n: '5.1',
        text: 'You must pay the “Establishment Fee” specified in the Disclosure Statement before you are allowed to access a Loan for the first time. You must pay the “Additional Loan Fee” for each additional Loan you take out. We may deduct the Establishment Fee and the Additional Loan Fee from the Initial Loan Amount with your consent.',
      },
      {
        n: '5.2',
        text: 'All reasonable costs, expenses and liabilities that we sustain in relation to protecting or enforcing, or attempting to protect or enforce, this Agreement (including legal costs, court filing fees and collection agency costs) must be paid by you. Such costs, expenses and liabilities will be debited to your Borrower Account and are payable by you as soon as they are so debited.',
      },
      {
        n: '5.3',
        text: 'You are responsible for meeting all legal costs and other expenses that you sustain in relation to the Loan. This includes the costs of making the Application, of accepting the Loan, signing the Agreement and of meeting any reasonable requirements that we make in relation to the Loan.',
      },
    ],
  },
  {
    n: '6',
    title: 'Dating and adjustment of debits and credits',
    clauses: [
      {
        n: '6.1',
        text: 'Subject to section 38 of the CCCFA, a debit or credit made by us to your Borrower Account is taken to have been made, and has effect, on the date assigned by us to the debit or credit and not on the date on which it is processed.',
      },
      {
        n: '6.2',
        text: 'Subject to section 47 of the CCCFA, we may later adjust debits or credits to your Borrower Account and the balance of your Borrower Account to accurately reflect your legal obligations to us.',
      },
    ],
  },
  {
    n: '7',
    title: 'Information disclosure, confirmations & authorisations',
    clauses: [
      {
        n: '7.1',
        text: 'You agree and confirm that, at all times:',
        sub: [
          {
            n: 'a',
            text: 'all information you provide to us, including prior to the date of this Agreement, is true, complete and up-to-date in all significant respects;',
          },
          {
            n: 'b',
            text: 'we have no obligation to check or verify that any information you provide to us is true, complete and up-to-date and, to the extent we do so, we do not confirm that the check or verification is complete or accurate;',
          },
          {
            n: 'c',
            text: 'where there has been any significant change in your personal or financial circumstances during the Loan term, you will promptly provide us with the relevant information (even if we do not request that information);',
          },
          {
            n: 'd',
            text: 'to the maximum extent permitted by law, we do not accept any responsibility or liability to you whatsoever (and howsoever arising) in connection with a lack of information, or inaccurate, untrue or incomplete information being provided by you (including as part of your Application), or on your behalf, to us.',
          },
        ],
      },
      {
        n: '7.2',
        text: 'We may collect personal information (that is, information about an identifiable individual) about you and other people. You agree and confirm that:',
        sub: [
          {
            n: 'a',
            text: 'we can collect, use, disclose, store, protect and provide access to your personal information in accordance with the Privacy Policy; and',
          },
          {
            n: 'b',
            text: 'when you provide personal information about other people to us, you have their authorisation to provide that information to us, and for us to use, disclose, store, protect and provide access to that information in accordance with the Privacy Policy.',
          },
        ],
      },
      {
        n: '7.3',
        text: 'You authorise (and you do not have any right or power to cancel the authorisation):',
        sub: [
          {
            n: 'a',
            text: 'us to disclose information we hold about you (including your history, defaults, and account status) to credit reporting agencies, and to other third parties as reasonably required in connection with the enforcement of this Agreement;',
          },
          {
            n: 'b',
            text: 'credit reporting agencies to hold personal information about you, that we provide, on their systems and the credit reporting agencies to use that information to provide credit reporting services, and to provide that information to their customers about you using their credit reporting services;',
          },
          {
            n: 'c',
            text: 'us to use the services of credit reporting agencies for purposes related to the provision of the Loan and/or any other credit to you including to obtain information about you;',
          },
          { n: 'd', text: 'us to give information to credit reporting agencies about your default in any payment obligations.' },
        ],
      },
    ],
  },
  {
    n: '8',
    title: 'Anti-money laundering compliance',
    clauses: [
      {
        n: '8.1',
        text: 'We are required to comply with the Anti-Money Laundering and Countering Financing of Terrorism Act 2009. In connection with that, you agree to promptly provide to us, at any time, on request, complete and true information in connection with our obligations under the Act including in relation to you and any beneficial owners and persons acting on your behalf.',
      },
      {
        n: '8.2',
        text: 'You agree and confirm that:',
        sub: [
          {
            n: 'a',
            text: 'we may, acting reasonably, suspend or cease providing services to you including declining a loan or requiring that you repay the Loan (even if not then due), in connection with information you provide (or that you fail to provide) to us, or that we hold about you or any related person;',
          },
          { n: 'b', text: 'we may not be able to disclose to you any matters relating to our use or disclosure of such information;' },
          {
            n: 'c',
            text: 'in addition to and without limiting any other provision of this Agreement (but subject to your rights under the Consumer Guarantees Act 1993), we have no responsibility or liability to you whatsoever, and howsoever arising, for anything we do or do not do, in connection with our obligations at law.',
          },
        ],
      },
    ],
  },
  {
    n: '9',
    title: 'If you fail to comply with the Agreement',
    clauses: [
      {
        n: '9.1',
        text: 'If any of the following matters arise (each a Failure to Comply):',
        sub: [
          { n: 'a', text: 'you fail to make payment on the relevant due date;' },
          {
            n: 'b',
            text: 'you fail to meet any of your other obligations under this Agreement or any other document or agreement that you have entered into, or in the future enter into, with us;',
          },
          {
            n: 'c',
            text: 'you no longer have full legal capacity, you become (or take steps to become) bankrupt or you enter into (or take steps to enter into) the no asset procedure;',
          },
          { n: 'd', text: 'any statement you make to us or to our agent is untrue, misleading or deceptive in any substantial way;' },
          {
            n: 'e',
            text: 'an event, or a series of events (whether related or not) occurs which, in our opinion, may cause a material negative change in your ability to comply with your obligations under this Agreement, or any other document or agreement you have entered into, or in the future enter into, with us,',
          },
        ],
        after:
          'then we (or any agent acting on our behalf) may take any one or more of the following actions (after giving any notice required by law and subject to our obligations at law including with respect to applications in relation to unforeseen hardship):',
        subAfter: [
          { n: 'f', text: 'require you to pay the entire Money Owed immediately;' },
          { n: 'g', text: 'cancel (terminate) this Agreement;' },
          { n: 'h', text: 'use any rights that we have under this Agreement or at law;' },
          {
            n: 'i',
            text: 'cancel any amount of the Initial Unpaid Balance we have not already paid to you (any amount cancelled will not be available to you).',
          },
        ],
      },
    ],
  },
  {
    n: '10',
    title: 'Notices',
    clauses: [
      {
        n: '10.1',
        text: 'Except for other ways that a party is permitted to provide a notice under the Agreement, all notices and communications given under this Agreement must be in writing and will be provided by email to the address set out in the Disclosure Statement (or, if your email address is not recorded, the email address you provided in, or used in relation to, your Application).',
      },
      {
        n: '10.2',
        text: 'In addition to clause 10.1, to the extent permitted in the Agreement, we may send notices and communications to your Mobile Number.',
      },
      {
        n: '10.3',
        text: 'Subject to clause 10.4, any notice given under this Agreement will be treated as being given:',
        sub: [
          {
            n: 'a',
            text: 'in the case of physical delivery, when actually delivered to the address in the Disclosure Statement and its receipt confirmed by a person at that address;',
          },
          {
            n: 'b',
            text: 'if posted, on the fourth Working Day after the day on which the letter is posted (and in proving the delivery it is enough to prove that the letter was properly addressed, stamped and posted);',
          },
          {
            n: 'c',
            text: 'if emailed, one hour after the email is sent unless a return email is received by the sender within that one-hour period stating that the addressee’s email address is wrong or that the message cannot be delivered;',
          },
          { n: 'd', text: 'in the case of a text message sent to your Mobile Number, immediately after it is validly sent.' },
        ],
      },
      {
        n: '10.4',
        text: 'A notice that is received before 9am on a Working Day shall be deemed to have been received at 9am on that Working Day and any other notice that is not received between 9am and 5pm on a Working Day shall be deemed to have been received at 9am on the next Working Day.',
      },
    ],
  },
  {
    n: '11',
    title: 'General',
    clauses: [
      {
        n: '11.1',
        text: (
          <>
            <strong>Entire agreement:</strong> Except to the extent stated otherwise in this Agreement, this Agreement is the
            full agreement between us and you relating to the matters dealt with in the Agreement and replaces all previous
            discussions and agreements about the matters in this Agreement.
          </>
        ),
      },
      {
        n: '11.2',
        text: (
          <>
            <strong>Waiver:</strong> To waive (release) a right under the Agreement, the waiver must be in writing and signed by
            the waiving party. No waiver of a Failure to Comply, or a failure to enforce any provision of, this Agreement at any
            time by a party in any way limits or waives the right of that party to later enforce and require full compliance
            with this Agreement.
          </>
        ),
      },
      {
        n: '11.3',
        text: (
          <>
            <strong>Partial invalidity:</strong> If any provision of the Agreement becomes invalid or unenforceable to any
            extent, the remainder of the Agreement and its application shall not be affected and shall remain enforceable to
            the greatest extent permitted by law.
          </>
        ),
      },
      {
        n: '11.4',
        text: (
          <>
            <strong>Provisions continue:</strong> The parts of this Agreement which, by their nature, are intended to continue
            after expiry or cancellation, including clauses 2.2, 2.5, 5.2, 5.3, 6, 7.2, 7.3, 10, 11.5 and 11.8 of these terms
            &amp; conditions, continue in force after expiry or cancellation.
          </>
        ),
      },
      {
        n: '11.5',
        text: (
          <>
            <strong>Rights and remedies are not mutually exclusive:</strong> To the fullest extent permitted by law, a
            party&rsquo;s powers, rights, discretions and remedies, whether provided for in this Agreement, at law, in equity
            or otherwise, are not mutually exclusive, can be exercised more than once, and are cumulative and not
            alternative, and may be exercised independently, or in any combination, at any time by that party.
          </>
        ),
      },
      {
        n: '11.6',
        text: (
          <>
            <strong>Transfer:</strong> You may not assign or transfer any of your rights, benefits or obligations under this
            Agreement. We may assign or transfer any of our rights, benefits and obligations under this Agreement.
          </>
        ),
      },
      {
        n: '11.7',
        text: (
          <>
            <strong>Changes:</strong> Any changes to the Agreement must be in writing and signed by both parties. Despite that,
            we may (acting reasonably) change or replace this Agreement at any time to the extent necessary or desirable in
            response to changes in law.
          </>
        ),
      },
      {
        n: '11.8',
        text: (
          <>
            <strong>Governing law and jurisdiction:</strong> The Agreement is governed by New Zealand law, and the parties
            submit to the non-exclusive jurisdiction of the New Zealand courts.
          </>
        ),
      },
      {
        n: '11.9',
        text: (
          <>
            <strong>Electronic signatures:</strong> This Agreement and any related documents may be signed and delivered by
            electronic means, including but not limited to scanned copies, PDF documents and electronic signature services
            (e.g., DocuSign, Adobe Sign). Any such electronically signed document shall be deemed to have the same legal
            effect, validity, and enforceability as a handwritten signature. References in this Agreement to the words
            &ldquo;execution&rdquo;, &ldquo;signature&rdquo; and similar words include electronic signatures and the record
            keeping in electronic form.
          </>
        ),
      },
    ],
  },
];

const DICTIONARY: Array<{ term: string; meaning: React.ReactNode }> = [
  { term: 'Agreement', meaning: 'These terms and conditions and the Disclosure Statement.' },
  { term: 'Annual Interest Rate', meaning: 'The “Annual Interest Rate” specified in the Disclosure Statement.' },
  { term: 'Application', meaning: 'The application form you completed in relation to the Loan.' },
  { term: 'Borrower Account', meaning: 'The account in which we record debits and credits of amounts relating to the Loan.' },
  { term: 'CCCFA', meaning: 'The Credit Contracts and Consumer Finance Act 2003.' },
  {
    term: 'Disclosure Statement',
    meaning: 'The disclosure statement provided to you, including the disclosure statement as varied or replaced from time-to-time.',
  },
  { term: 'Failure to Comply', meaning: 'Has the meaning given to that term in clause 9.1.' },
  {
    term: 'Full Prepayment',
    meaning: 'The payment of the Unpaid Balance before the last amount to be paid under this Agreement becomes payable.',
  },
  { term: 'Initial Unpaid Balance', meaning: 'Has the meaning given to that term in the Disclosure Statement.' },
  { term: 'Loan', meaning: 'The loan to be made by us to you on the terms and conditions in this Agreement.' },
  { term: 'Loan Access Date', meaning: 'The date that you sign this Agreement.' },
  { term: 'Loan Amount', meaning: 'The “Initial Unpaid Balance” specified in the Disclosure Statement.' },
  {
    term: 'Mobile Number',
    meaning: 'Your mobile number in the Disclosure Statement or otherwise provided by you including in your Application.',
  },
  {
    term: 'Money Owed',
    meaning:
      'All amounts payable by you to us under or in connection with this Agreement from time to time, including accrued interest and the Unpaid Balance.',
  },
  {
    term: 'Nominated Bank Account',
    meaning: 'The NZD bank account in New Zealand you nominate in the Application as the account into which the Loan Amount is to be paid.',
  },
  { term: 'Payment Schedule', meaning: 'The “Payment Schedule” in the Disclosure Statement.' },
  {
    term: 'Privacy Policy',
    meaning: (
      <>
        Our privacy policy from time-to-time, available at <Link href="/privacy-policy">terepay.com/privacy-policy</Link>.
      </>
    ),
  },
  {
    term: 'Unpaid Balance',
    meaning:
      'The amount owing under this Agreement at a particular time, being the difference between all amounts credited and all amounts debited to your Borrower Account under this Agreement at that time.',
  },
  { term: 'Unpaid Daily Balance', meaning: 'In relation to a day, means the Unpaid Balance at the end of that day.' },
  {
    term: 'Working Day',
    meaning: 'Monday to Friday, other than any national public holiday within the meaning of section 44 of the Holidays Act 2003.',
  },
];

function SubClauses({ items, prefix }: { items: SubClause[]; prefix: string }) {
  return (
    <ol className="tp-clause__sub">
      {items.map((s) => (
        <li key={`${prefix}${s.n}`}>
          <span className="tp-clause__num">({s.n})</span>
          <div>
            <p>{s.text}</p>
            {s.sub && <SubClauses items={s.sub} prefix={`${prefix}${s.n}.`} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ClauseItem({ clause }: { clause: Clause }) {
  return (
    <li>
      <span className="tp-clause__num">{clause.n}</span>
      <div>
        <p>{clause.text}</p>
        {clause.sub && <SubClauses items={clause.sub} prefix={`${clause.n}`} />}
        {clause.after && <p className="mt-2">{clause.after}</p>}
        {clause.subAfter && <SubClauses items={clause.subAfter} prefix={`${clause.n}`} />}
      </div>
    </li>
  );
}

export default function TermsAndConditionsPage() {
  return (
    <LegalArticle slug={SLUG} lead="See clause 12.1 for definitions of capitalised terms.">
      <ol className="tp-clauses">
        {SECTIONS.map((section) => (
          <li key={section.n}>
            <h2 className="tp-clause__title !mt-0">
              <span className="tp-clause__num">{section.n}.</span>
              <span>{section.title}</span>
            </h2>
            <ol className="tp-clause__list">
              {section.clauses.map((c) => (
                <ClauseItem key={c.n} clause={c} />
              ))}
            </ol>
          </li>
        ))}

        <li>
          <h2 className="tp-clause__title !mt-0">
            <span className="tp-clause__num">12.</span>
            <span>Dictionary &amp; interpretation</span>
          </h2>
          <ol className="tp-clause__list">
            <li>
              <span className="tp-clause__num">12.1</span>
              <div>
                <p>
                  <strong>Dictionary:</strong> In the Agreement, unless the context requires otherwise, the following
                  terms have the following meanings:
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Term</th>
                      <th scope="col">Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DICTIONARY.map((d) => (
                      <tr key={d.term}>
                        <td className="whitespace-nowrap font-semibold text-[var(--text-strong)]">{d.term}</td>
                        <td>{d.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
            <li>
              <span className="tp-clause__num">12.2</span>
              <div>
                <p>
                  <strong>Interpretation:</strong> In this Agreement:
                </p>
                <SubClauses
                  prefix="12.2"
                  items={[
                    {
                      n: 'a',
                      text: 'a reference to:',
                      sub: [
                        { n: 'i', text: 'you, your is to the “Debtor” named in the Disclosure Statement;' },
                        {
                          n: 'ii',
                          text: 'TerePay, we, us, our is to TerePay Neophile Ltd, the “Creditor” named in the Disclosure Statement;',
                        },
                        { n: 'iii', text: 'including and similar words do not imply any limitation;' },
                        {
                          n: 'iv',
                          text: 'a statute includes references to regulations, orders or notices made under or in connection with the statute or regulations and all amendments, replacements or other changes to any of them;',
                        },
                        {
                          n: 'v',
                          text: 'a party is a reference to a party to this Agreement, and includes that party’s executors and permitted assigns; and',
                        },
                        { n: 'vi', text: '$ or dollars are to New Zealand currency;' },
                      ],
                    },
                    { n: 'b', text: 'the headings in this Agreement are for convenience only and have no legal effect; and' },
                    { n: 'c', text: 'the singular includes the plural and vice versa.' },
                  ]}
                />
              </div>
            </li>
          </ol>
        </li>
      </ol>
    </LegalArticle>
  );
}
