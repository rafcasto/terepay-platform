/**
 * Default text for the public legal / compliance pages.
 *
 * Each document is editable in the content editor (section `legal.<slug>`);
 * the values here are the built-in defaults, merged under whatever has been
 * saved in Firestore. They use the plain-text document format understood by
 * `renderDocument()` in `src/lib/content/document.tsx`:
 *
 *   ## Heading              second-level heading
 *   ### Heading             third-level heading
 *   - item                  bullet list (indent two spaces to nest)
 *   1. item                 numbered list
 *   1.1 text / (a) text     numbered legal clause (indent two spaces per level)
 *   | Term | Meaning |      table (first row is the header)
 *   **bold**                emphasis
 *   [label](https://…)      link (https, mailto, tel or a site path like /privacy-policy)
 *
 * Any other line is a paragraph. Blank lines separate blocks.
 *
 * Pure data — safe to import from both server and client code.
 */

export interface LegalDocumentDefaults {
  title: string;
  lead: string;
  body: string;
  /** Defaults to published. Set `false` for pages that start as a blank draft. */
  published?: boolean;
}

export const LEGAL_DOCUMENTS: Record<string, LegalDocumentDefaults> = {
  // Blank draft — the content editor fills this in and publishes it.
  'annual-interest-rate': {
    title: 'Annual Interest Rate',
    lead: '',
    body: '',
    published: false,
  },

  'disclosure-statement': {
    title: 'Disclosure Statement',
    lead: 'Advice about your credit contract is not regulated financial advice.',
    body: `## You are protected by responsible lending laws
Because of these protections, the recommendations given to you about your application or account are not regulated financial advice. This means that duties and requirements imposed on people who give financial advice do not apply to these recommendations. This includes a duty to comply with a code of conduct and a requirement to be licensed.

© Terepay Neophile Limited. TEREPAY and the TerePay logo are registered trademarks of Terepay Neophile Limited. All rights reserved.`,
  },

  'rates-and-fees-policy': {
    title: 'Rates and Fees Policy',
    lead: 'Credit, default and enforcement fees and charges.',
    body: `## Establishment and application fees
- New Customer Establishment Fee: $50.00 (**for new customers only**)
- Additional Loan Application Fee: $20.00 (for any additional loan taken out after your first loan)

These fees may be deducted from the loan amount, with the borrower's consent.

## Early repayment fee
- Prepayment Fee: $25.00 (when the loan is repaid early in full, to cover administrative costs)

## Default fees
- Late Payment Fee: $10.00. This is applied for each missed payment (only after a 3-day grace period), so late fees can be up to a maximum of $40.00.
- Payment Default Fee: $25.00 (applied only after a 7-day grace period), in addition to the Late Payment Fee. This fee is only charged once even if there are further late payments.

## Additional cost recovery
The loan agreement also allows us to recover reasonable costs related to protecting or enforcing the agreement, including:
- Legal costs
- Court filing fees
- Collection agency costs

These fees and costs must be paid for by the borrower. They will be added to the loan and must be paid immediately.

All fees and costs are in New Zealand dollars and are separate from the loan's interest charges.`,
  },

  'unforeseen-financial-hardship-policy': {
    title: 'Unforeseen Hardship & Financial Difficulty',
    lead: 'Life can sometimes take unexpected turns, and these events may affect your ability to keep up with loan repayments. We encourage you to reach out to us early.',
    body: `At TerePay, we encourage you to reach out to us early if you are experiencing, or expect to experience, unforeseen hardship or other financial difficulty.

## Examples of situations that may lead to financial difficulty
Examples of situations that may lead to unforeseen hardship or other types of financial difficulty include:
- Injury or illness
- Loss of employment or reduced income
- Relationship changes (divorce or separation)
- Pregnancy or new family responsibilities
- Natural disasters affecting your home or income
- Ongoing medical treatment or health challenges
- Other unforeseen events that impact your finances

If any of these apply to you, please contact us as soon as possible. We can consider options to support you through this period.

"Unforeseen hardship" is a type of financial difficulty. We explain what "unforeseen hardship" means below and your rights in that situation. After that we explain some other types of financial difficulty and what we may be able to do if you experience such financial difficulty.

## What to do if you suffer unforeseen hardship
If you are unable reasonably to keep up your payments or other obligations because of illness, injury, loss of employment, the end of a relationship, or other reasonable cause, you may be able to apply to us for a hardship variation. In some circumstances [listed in the Credit Contracts and Consumer Finance Act 2003](https://www.legislation.govt.nz/act/public/2003/0052/latest/DLM213121.html) you are not entitled to make an application (but we might be able to consider that — see "Other types of financial difficulty" below).

To apply for a hardship variation, you need to:
1. make an application to us in writing;
2. explain your reason(s) for the application; and
3. request one of the following:
  - an extension of the term of the contract (which will reduce the amount of each payment due under the contract); or
  - a postponement of the dates on which payments are due under the contract (specify the period for which you want this to apply); or
  - both of the above; and
4. give the application to us.

Do this as soon as possible. If you leave it for too long, we may not have to consider your application.

You may give that notice in the following ways:
- deliver it to our address specified in our Disclosure Statement; or
- post it to our address specified in our Disclosure Statement; or
- email it to our email address specified in our Disclosure Statement.

## What happens next?
We may ask for further information and supporting documents such as ACC letters or medical certificates.

Once we review your request we will let you know whether we agree to make a hardship variation. If we agree to make a variation we'll send you a document to review and sign before any changes are made.

Until changes are confirmed, please continue making payments where you can.

## Other types of financial difficulty
If you are experiencing financial difficulty other than "unforeseen hardship" (above) or if you are not eligible to make a hardship application, we may be able to assist you in ways that are fair and reasonable to both us and you. Examples of situations that may lead to financial difficulty are above. In those situations you may miss, or be at risk of missing, making payments to us on the date for payment.

You can contact us at any time about a financial difficulty or possible financial difficulty. We may request information about that from you such as bank statements, payslips, or other proof of income. Once we have enough information we will consider your situation and whether to help you. That may include extending the loan term (length), extending payment dates, waiving fees, or assisting you to get help from professionals such as budget advisers.

## Getting advice
If you're facing financial difficulties, free support may be available through MoneyTalks.
- Call [0800 345 123](tel:0800345123)
- Visit [moneytalks.co.nz](https://moneytalks.co.nz)

There are other services that also provide support.`,
  },

  'dispute-resolution-policy': {
    title: 'Complaints & Dispute Resolution',
    lead: 'If you are unhappy with your experience with TerePay, we want to know about it.',
    body: `## How to make a complaint
The best way to make a complaint is to get in touch with TerePay through the contact methods below.
- Phone (call or text): [+64 22 135 8538](tel:+64221358538)
- Email: [info@terepay.com](mailto:info@terepay.com)

We will try to resolve your complaint to your satisfaction.

## Independent dispute resolution
If you are not satisfied with our decision about your complaint you can refer the complaint to our independent external dispute resolution scheme, Financial Services Complaints Ltd (FSCL). It is free to make a complaint to FSCL. FSCL may help you to resolve any disagreements you have with us free of charge. FSCL's contact details are:
- Phone: [0800 347 257](tel:0800347257)
- Website: [www.fscl.org.nz](https://www.fscl.org.nz/)
- Email: [complaints@fscl.org.nz](mailto:complaints@fscl.org.nz)`,
  },

  'terms-and-conditions': {
    title: 'Consumer Credit Contract Terms and Conditions',
    lead: 'See clause 12.1 for definitions of capitalised terms.',
    body: `## 1. Loan & access to the Loan
1.1 You agree to borrow the Loan from us for the term (length) specified in the Disclosure Statement.
1.2 The Loan Amount will be paid to your Nominated Bank Account on the Loan Access Date. However, we have the right to decline to provide the Loan, if you have not complied, or are currently not complying, with this Agreement.
1.3 We will pay the Loan Amount to you in one amount unless we agree otherwise in writing.

## 2. Payments
2.1 You must repay the Loan according to the Payment Schedule.
2.2 You must pay all amounts payable under this Agreement without any set-off, deduction, withholding or claim (except as required by law). All of your payments must be made by electronic funds transfer to the bank account we notify to you from time-to-time. We will not accept payment made in any other way and we will return such payments to you as soon as reasonably possible.
2.3 The Payment Schedule has been prepared on the following assumptions:
  (a) that we will pay the entire Loan Amount to you on the Loan Access Date;
  (b) the only fees you have to pay are the "Establishment Fee" (if any) and the "Additional Loan Application Fee" (if any) specified in the Disclosure Statement;
  (c) that you will pay all amounts due under this Agreement on time and that you will comply with this Agreement at all times.
  If your payments are late then the amounts you have to pay will be more than those specified in the Payment Schedule. We can decide to waive (agree not to charge) some or all of those additional amounts at our sole option.
2.4 If we use our power under clauses 8.2a or 9.1f to require you to pay the entire Unpaid Balance, the Payment Schedule shall be adjusted so that the only remaining payment is a payment of the entire Unpaid Balance on the date that we use that power.
2.5 We may, at our sole discretion, credit any payments (including any early payments) from you (other than a Full Prepayment) made under this Agreement to your Borrower Account in accordance with the Payment Schedule. Any payment made under this Agreement that we do not agree to credit in accordance with the Payment Schedule must be credited to your Borrower Account as soon as practicable after it is received. In this clause 2, "as soon as practicable" has the meaning given to it in section 46(2) of the CCCFA.

## 3. Interest & default fees
3.1 You must pay interest on the Loan. Interest accrues at the Annual Interest Rate on the Unpaid Balance. Interest charges will be calculated and accrue each day by applying the applicable daily interest rate to that day's Unpaid Daily Balance. The applicable daily interest rate is the Annual Interest Rate divided by 365. If your payments are late then the total interest charges will be higher. We can decide to waive (agree not to charge) some or all of those higher charges at our sole option.
3.2 If you fail to pay an amount payable under this Agreement, you must pay the "Default Fees" as required by the Disclosure Statement.
3.3 Interest charges will be debited to your Borrower Account fortnightly from the Loan Access Date and must be paid by you on the dates specified in the Payment Schedule.

## 4. Repaying the Loan early
4.1 You may make a Full Prepayment at any time.
4.2 You may make a part prepayment at any time. That is, you may make a payment before the relevant date for payment specified in the Payment Schedule. However, unless the prepayment is a Full Prepayment (see clauses 4.3 and 4.4) or we notify you otherwise, we will not credit (apply) the prepayment to your Borrower Account until the scheduled payment date. As a result you will not receive any interest savings for paying early.
4.3 The amount required to make a Full Prepayment is the total of the following amounts:
  (a) the Unpaid Balance at the time of the Full Prepayment; and
  (b) the "Early Payment Fee" specified in the Disclosure Statement to reasonably compensate us for any administrative costs incurred by us in relation to the Full Prepayment.
4.4 We must credit a Full Prepayment you make to your Borrower Account as soon as practicable after it is received. In this clause "as soon as practicable" has the meaning given to it in section 46(2) of the CCCFA.

## 5. Fees and charges
5.1 You must pay the "Establishment Fee" specified in the Disclosure Statement before you are allowed to access a Loan for the first time. You must pay the "Additional Loan Fee" for each additional Loan you take out. We may deduct the Establishment Fee and the Additional Loan Fee from the Initial Loan Amount with your consent.
5.2 All reasonable costs, expenses and liabilities that we sustain in relation to protecting or enforcing, or attempting to protect or enforce, this Agreement (including legal costs, court filing fees and collection agency costs) must be paid by you. Such costs, expenses and liabilities will be debited to your Borrower Account and are payable by you as soon as they are so debited.
5.3 You are responsible for meeting all legal costs and other expenses that you sustain in relation to the Loan. This includes the costs of making the Application, of accepting the Loan, signing the Agreement and of meeting any reasonable requirements that we make in relation to the Loan.

## 6. Dating and adjustment of debits and credits
6.1 Subject to section 38 of the CCCFA, a debit or credit made by us to your Borrower Account is taken to have been made, and has effect, on the date assigned by us to the debit or credit and not on the date on which it is processed.
6.2 Subject to section 47 of the CCCFA, we may later adjust debits or credits to your Borrower Account and the balance of your Borrower Account to accurately reflect your legal obligations to us.

## 7. Information disclosure, confirmations & authorisations
7.1 You agree and confirm that, at all times:
  (a) all information you provide to us, including prior to the date of this Agreement, is true, complete and up-to-date in all significant respects;
  (b) we have no obligation to check or verify that any information you provide to us is true, complete and up-to-date and, to the extent we do so, we do not confirm that the check or verification is complete or accurate;
  (c) where there has been any significant change in your personal or financial circumstances during the Loan term, you will promptly provide us with the relevant information (even if we do not request that information);
  (d) to the maximum extent permitted by law, we do not accept any responsibility or liability to you whatsoever (and howsoever arising) in connection with a lack of information, or inaccurate, untrue or incomplete information being provided by you (including as part of your Application), or on your behalf, to us.
7.2 We may collect personal information (that is, information about an identifiable individual) about you and other people. You agree and confirm that:
  (a) we can collect, use, disclose, store, protect and provide access to your personal information in accordance with the Privacy Policy; and
  (b) when you provide personal information about other people to us, you have their authorisation to provide that information to us, and for us to use, disclose, store, protect and provide access to that information in accordance with the Privacy Policy.
7.3 You authorise (and you do not have any right or power to cancel the authorisation):
  (a) us to disclose information we hold about you (including your history, defaults, and account status) to credit reporting agencies, and to other third parties as reasonably required in connection with the enforcement of this Agreement;
  (b) credit reporting agencies to hold personal information about you, that we provide, on their systems and the credit reporting agencies to use that information to provide credit reporting services, and to provide that information to their customers about you using their credit reporting services;
  (c) us to use the services of credit reporting agencies for purposes related to the provision of the Loan and/or any other credit to you including to obtain information about you;
  (d) us to give information to credit reporting agencies about your default in any payment obligations.

## 8. Anti-money laundering compliance
8.1 We are required to comply with the Anti-Money Laundering and Countering Financing of Terrorism Act 2009. In connection with that, you agree to promptly provide to us, at any time, on request, complete and true information in connection with our obligations under the Act including in relation to you and any beneficial owners and persons acting on your behalf.
8.2 You agree and confirm that:
  (a) we may, acting reasonably, suspend or cease providing services to you including declining a loan or requiring that you repay the Loan (even if not then due), in connection with information you provide (or that you fail to provide) to us, or that we hold about you or any related person;
  (b) we may not be able to disclose to you any matters relating to our use or disclosure of such information;
  (c) in addition to and without limiting any other provision of this Agreement (but subject to your rights under the Consumer Guarantees Act 1993), we have no responsibility or liability to you whatsoever, and howsoever arising, for anything we do or do not do, in connection with our obligations at law.

## 9. If you fail to comply with the Agreement
9.1 If any of the following matters arise (each a Failure to Comply):
  (a) you fail to make payment on the relevant due date;
  (b) you fail to meet any of your other obligations under this Agreement or any other document or agreement that you have entered into, or in the future enter into, with us;
  (c) you no longer have full legal capacity, you become (or take steps to become) bankrupt or you enter into (or take steps to enter into) the no asset procedure;
  (d) any statement you make to us or to our agent is untrue, misleading or deceptive in any substantial way;
  (e) an event, or a series of events (whether related or not) occurs which, in our opinion, may cause a material negative change in your ability to comply with your obligations under this Agreement, or any other document or agreement you have entered into, or in the future enter into, with us,
  then we (or any agent acting on our behalf) may take any one or more of the following actions (after giving any notice required by law and subject to our obligations at law including with respect to applications in relation to unforeseen hardship):
  (f) require you to pay the entire Money Owed immediately;
  (g) cancel (terminate) this Agreement;
  (h) use any rights that we have under this Agreement or at law;
  (i) cancel any amount of the Initial Unpaid Balance we have not already paid to you (any amount cancelled will not be available to you).

## 10. Notices
10.1 Except for other ways that a party is permitted to provide a notice under the Agreement, all notices and communications given under this Agreement must be in writing and will be provided by email to the address set out in the Disclosure Statement (or, if your email address is not recorded, the email address you provided in, or used in relation to, your Application).
10.2 In addition to clause 10.1, to the extent permitted in the Agreement, we may send notices and communications to your Mobile Number.
10.3 Subject to clause 10.4, any notice given under this Agreement will be treated as being given:
  (a) in the case of physical delivery, when actually delivered to the address in the Disclosure Statement and its receipt confirmed by a person at that address;
  (b) if posted, on the fourth Working Day after the day on which the letter is posted (and in proving the delivery it is enough to prove that the letter was properly addressed, stamped and posted);
  (c) if emailed, one hour after the email is sent unless a return email is received by the sender within that one-hour period stating that the addressee's email address is wrong or that the message cannot be delivered;
  (d) in the case of a text message sent to your Mobile Number, immediately after it is validly sent.
10.4 A notice that is received before 9am on a Working Day shall be deemed to have been received at 9am on that Working Day and any other notice that is not received between 9am and 5pm on a Working Day shall be deemed to have been received at 9am on the next Working Day.

## 11. General
11.1 **Entire agreement:** Except to the extent stated otherwise in this Agreement, this Agreement is the full agreement between us and you relating to the matters dealt with in the Agreement and replaces all previous discussions and agreements about the matters in this Agreement.
11.2 **Waiver:** To waive (release) a right under the Agreement, the waiver must be in writing and signed by the waiving party. No waiver of a Failure to Comply, or a failure to enforce any provision of, this Agreement at any time by a party in any way limits or waives the right of that party to later enforce and require full compliance with this Agreement.
11.3 **Partial invalidity:** If any provision of the Agreement becomes invalid or unenforceable to any extent, the remainder of the Agreement and its application shall not be affected and shall remain enforceable to the greatest extent permitted by law.
11.4 **Provisions continue:** The parts of this Agreement which, by their nature, are intended to continue after expiry or cancellation, including clauses 2.2, 2.5, 5.2, 5.3, 6, 7.2, 7.3, 10, 11.5 and 11.8 of these terms & conditions, continue in force after expiry or cancellation.
11.5 **Rights and remedies are not mutually exclusive:** To the fullest extent permitted by law, a party's powers, rights, discretions and remedies, whether provided for in this Agreement, at law, in equity or otherwise, are not mutually exclusive, can be exercised more than once, and are cumulative and not alternative, and may be exercised independently, or in any combination, at any time by that party.
11.6 **Transfer:** You may not assign or transfer any of your rights, benefits or obligations under this Agreement. We may assign or transfer any of our rights, benefits and obligations under this Agreement.
11.7 **Changes:** Any changes to the Agreement must be in writing and signed by both parties. Despite that, we may (acting reasonably) change or replace this Agreement at any time to the extent necessary or desirable in response to changes in law.
11.8 **Governing law and jurisdiction:** The Agreement is governed by New Zealand law, and the parties submit to the non-exclusive jurisdiction of the New Zealand courts.
11.9 **Electronic signatures:** This Agreement and any related documents may be signed and delivered by electronic means, including but not limited to scanned copies, PDF documents and electronic signature services (e.g., DocuSign, Adobe Sign). Any such electronically signed document shall be deemed to have the same legal effect, validity, and enforceability as a handwritten signature. References in this Agreement to the words "execution", "signature" and similar words include electronic signatures and the record keeping in electronic form.

## 12. Dictionary & interpretation
12.1 **Dictionary:** In the Agreement, unless the context requires otherwise, the following terms have the following meanings:
| Term | Meaning |
| Agreement | These terms and conditions and the Disclosure Statement. |
| Annual Interest Rate | The "Annual Interest Rate" specified in the Disclosure Statement. |
| Application | The application form you completed in relation to the Loan. |
| Borrower Account | The account in which we record debits and credits of amounts relating to the Loan. |
| CCCFA | The Credit Contracts and Consumer Finance Act 2003. |
| Disclosure Statement | The disclosure statement provided to you, including the disclosure statement as varied or replaced from time-to-time. |
| Failure to Comply | Has the meaning given to that term in clause 9.1. |
| Full Prepayment | The payment of the Unpaid Balance before the last amount to be paid under this Agreement becomes payable. |
| Initial Unpaid Balance | Has the meaning given to that term in the Disclosure Statement. |
| Loan | The loan to be made by us to you on the terms and conditions in this Agreement. |
| Loan Access Date | The date that you sign this Agreement. |
| Loan Amount | The "Initial Unpaid Balance" specified in the Disclosure Statement. |
| Mobile Number | Your mobile number in the Disclosure Statement or otherwise provided by you including in your Application. |
| Money Owed | All amounts payable by you to us under or in connection with this Agreement from time to time, including accrued interest and the Unpaid Balance. |
| Nominated Bank Account | The NZD bank account in New Zealand you nominate in the Application as the account into which the Loan Amount is to be paid. |
| Payment Schedule | The "Payment Schedule" in the Disclosure Statement. |
| Privacy Policy | Our privacy policy from time-to-time, available at [terepay.com/privacy-policy](/privacy-policy). |
| Unpaid Balance | The amount owing under this Agreement at a particular time, being the difference between all amounts credited and all amounts debited to your Borrower Account under this Agreement at that time. |
| Unpaid Daily Balance | In relation to a day, means the Unpaid Balance at the end of that day. |
| Working Day | Monday to Friday, other than any national public holiday within the meaning of section 44 of the Holidays Act 2003. |
12.2 **Interpretation:** In this Agreement:
  (a) a reference to:
    (i) you, your is to the "Debtor" named in the Disclosure Statement;
    (ii) TerePay, we, us, our is to TerePay Neophile Ltd, the "Creditor" named in the Disclosure Statement;
    (iii) including and similar words do not imply any limitation;
    (iv) a statute includes references to regulations, orders or notices made under or in connection with the statute or regulations and all amendments, replacements or other changes to any of them;
    (v) a party is a reference to a party to this Agreement, and includes that party's executors and permitted assigns; and
    (vi) $ or dollars are to New Zealand currency;
  (b) the headings in this Agreement are for convenience only and have no legal effect; and
  (c) the singular includes the plural and vice versa.`,
  },

  'privacy-policy': {
    title: 'Privacy Policy',
    lead: 'How TerePay Neophile Limited collects, uses, discloses, stores and protects your personal information.',
    body: `## Introduction
This privacy policy explains how TerePay Neophile Limited (we, us, our) collects, uses, discloses, stores and protects your personal information. We comply with the Privacy Act 2020 (the Act) when dealing with your personal information. Personal information is information about an identifiable individual (a natural person).

By providing personal information to us you consent to us collecting, using, disclosing, storing and protecting your personal information in accordance with this privacy policy.

You are not required to provide the personal information that we request. However, if you choose not to provide personal information, in many cases we will not be able to provide our products and services to you.

## Updates
We may change our privacy policy by uploading an updated version to our website ([terepay.com/privacy-policy](/privacy-policy)). The change will apply from the date that we upload the updated version. We will not notify you of a change unless it has a significant impact on your rights.

## What personal information we collect
We collect personal information about you in connection with queries you make, assessing loan applications we receive from you, providing and administering loans you take out, and in connection with any competitions or promotions we provide to you. The types of information we collect may include:
- Your contact information including your email address and mobile phone number.
- Your identity information including your name, date of birth, copy of your driver's licence or passport, your residential address.
- Your financial information including your income, expenses and assets (for example, from bank statements) and the purpose of the loan.
- Your relationship and family information, for example your marital status, number of dependents.
- Your citizenship or residency status.
- Your employment information, for example, salary, work history.
- Your credit history and credit scores including the length of your credit file, number of unpaid defaults.
- Information about the device you use to access our website ([terepay.com](/)) or social media sites, such as IP address, browser type, time zone settings and mobile network information.

## How we collect personal information
Where possible we collect your personal information directly from you, through contact with us, for example, in a meeting, or via an email, website.

We also collect information about you indirectly, if you apply for a loan. We collect that information from:
- Credit reporting agencies including Centrix Group Limited – your credit history including your credit rating and any previous payment defaults.
- DataZoo – information about you, if you are or may be a "politically exposed person" which is unlikely (this is required by law).

If you provide us with personal information about another person (such as joint borrower or guarantor), you are confirming they have authorised disclosure of their personal information to us in accordance with this privacy policy.

## How we use personal information
We collect personal information for the following purposes:
- To assess any application you make including to assess whether you meet our lending criteria (credit check), and to provide information about you to credit reporting agencies (including information about defaults).
- To provide our products and services (and to assist in improving our services).
- To communicate with you.
- To make contact with you in the future about matters we believe will be of interest.
- In connection with defending, protecting and/or enforcing our legal rights and interests including to enforce defaults and (where appropriate) to defend a complaint, claim or other action.
- To conduct research and statistical analysis (on an anonymised basis).
- To comply with our obligations at law under the Anti-Money Laundering and Countering Financing of Terrorism Act 2009 and the Credit Contracts and Consumer Finance Act 2003, and related regulations, including to verify your identity, your residential address and to carry out politically exposed person checks in relation to you.
- For any other purpose authorised by you or the Act.

## Who we disclose personal information to
We may disclose your personal information to:
- Providers of IT and software services to us including Google LLC (Google Workspace), Microsoft Corporation (including Microsoft New Zealand Ltd) and Adobe in order to use their respective cloud-based business software systems (in the case of Microsoft Corporation that includes the applications Word, Outlook, OneDrive and Copilot), signNow (airSlate) (to arrange for electronic signing of documents).
- Credit reporting agencies including Centrix Group Limited in relation to carrying out credit checks on you and providing information about your conduct (including on any defaults). We will provide your personal information to Centrix Group Limited when we use their consumer credit reporting services (for example, for credit checking). Centrix will collect your credit information for the purpose of providing credit reporting services to us and other subscribers to Centrix's consumer credit reporting services, and Centrix will use and disclose your credit information in accordance with the Centrix Privacy Statement. You have rights of access to, and correction of, your credit information and any other personal information held by Centrix as set out in the Centrix Privacy Statement. Details of how Centrix handles your personal information can be found here: [centrix.co.nz/privacy-statement](https://www.centrix.co.nz/privacy-statement/).
- Other businesses that support provision of our services including DataZoo (for verifying your identity information), banks (direct debit authorities you provided and information on payments you make to us) and accountants (information on your payments).
- NZ Transport Agency, Ministry of Justice, Department of Internal Affairs, Immigration NZ, employers, to verify the information and documents you have provided.
- Compliance advisers and legal advisers, if we seek advice on compliance matters relating to you.
- Lawyers and other professionals, and our insurers (and their advisers), our dispute resolution services, in connection with defending, protecting and/or enforcing our legal rights & interests and (where appropriate) a complaint, claim or other action.
- A dispute resolution service in connection with any complaint you refer to the service.
- Any other person authorised by the Act or another law.
- Any other person authorised by you.

A business that supports provision of our products and services may be located outside New Zealand. This means that your personal information may be held and processed outside New Zealand.

## How we protect personal information
We will take steps that are reasonable in the circumstances to keep your personal information safe from loss and from unauthorised access, use, modification or disclosure.

## How long we keep your information
Except as otherwise permitted or required by applicable law, we will retain your personal information only for as long as we believe is necessary to fulfil the purposes for which the personal information was collected. We may, instead of destroying or erasing your personal information, make it anonymous, so that it cannot be associated with or tracked back to you.

## Accessing and correcting personal information
Subject to certain grounds for refusal set out in the Act, you have the right to access your personal information that we hold about you and to request a correction to that personal information. We can be contacted in one of the following ways:
- **Phone number:** [+64 9 886 7158](tel:+6498867158)
- **Email address:** [info@terepay.com](mailto:info@terepay.com)

## Cookies and other data storing technologies
We use cookies, mobile device IDs, and similar data storage technologies when you visit our website (Digital Platforms). A cookie is a small block of text file stored on your device when you visit a website. Cookies help us to identify your browser, provide you with customised service, and advertise more effectively.

We also use Google analytics tools which use cookies to monitor and collect information on traffic to and the use of our Digital Platforms.

You can prevent the use of cookies by disabling cookies on your browser. However, this may restrict your ability to make full use of our Digital Platforms.`,
  },

  'website-terms-of-use': {
    title: 'Website Terms of Use',
    lead: 'Please read these terms carefully before continuing to use or browse the website.',
    body: `The website [terepay.com](/) (Website) is owned and maintained by TerePay Neophile Limited (we, us, our). Please read these terms of use (Terms) carefully before continuing to use or browse the Website. By accessing and using the Website you are deemed to have accepted these Terms and agreed to be bound by them.

Our current [Privacy Policy](/privacy-policy) forms part of these Terms. These Terms (including the Privacy Policy) form the entire agreement between us and you relating to your access to and use of the Website.

We reserve the right to change or modify the Terms at any time, without giving you prior notice. Any change will take effect once posted on the Website.

## 1. About this Website
The Website is not an offer to provide products or services to you and any communication you send to us does not impose any obligation on us.

The information on the Website is general information only, is not advice, is not an endorsement or recommendation of any kind including regarding the value or suitability of any particular course of action or transaction. The calculators on the Website and their results are not a recommendation to borrow or confirmation that we will provide you with a loan. We recommend you seek appropriate advice (including personalised financial advice) from relevant qualified professionals that suit your circumstances.

## 2. Our products and services
Our products and services are provided to New Zealand residents only. Applications for credit are subject to responsible lender checks and our credit criteria.

## 3. No warranties
To the maximum extent permitted by law, we make no representations, warranties, and guarantees of any kind (express or implied) including (without limitation) about the accuracy, reliability, completeness, suitability or availability of the Website or the information contained on the Website (including the results from the loan calculators).

The information on the Website is subject to change at any time and may, at times, be out of date, inaccurate and/or incomplete.

To the maximum extent permitted by law, we are under no obligation, and we accept no responsibility, to update any information (including the results from the loan calculators) on the Website or to correct any errors in the information after it is published on the Website, nor do we accept any liability for any failure to do so.

Any reference to historical information and performance of a product or service may not necessarily be a good guide to future performance. You are solely responsible for any actions you take or do not take by relying on such information.

## 4. No liability
To the maximum extent permitted by law, we and our directors, contractors, business associates, consultants and staff are not liable for any damage, losses (including loss of profit, income, or saving), costs or expenses of any kind, whether direct, indirect or consequential, howsoever arising, suffered or incurred by you in connection with your access to or use of the Website or the information on or accessed from or through the Website (including the content of other websites accessed from our Website). Nothing in these Terms has the effect of contracting out of your rights under the Consumer Guarantees Act 1993 or other consumer protection law that cannot be contracted out of. However, if you are using the Website or its content in trade, the Consumer Guarantees Act 1993 will not apply to you and you agree and confirm that it is fair and reasonable that the Act does not apply to you.

## 5. Jurisdiction & governing law
The information is only intended for persons in New Zealand and is not intended for persons outside New Zealand. The laws of New Zealand shall govern your use of the Website and you agree to submit to the non-exclusive jurisdiction of the New Zealand courts. To the maximum extent permitted by law, we are not responsible or liable for any failure of the Website to comply with the laws of any other country.

## 6. Virus protection
We do not guarantee that the Website will always be secure and free of viruses or bugs, or will be accessible without any interruption. You acknowledge that it is your responsibility to implement sufficient procedures and virus checks (including anti-virus and other security checks).

## 7. Linked websites
The Website may contain links to other websites. These websites are neither under the control of, nor monitored by us and we have no knowledge of or control over the nature, content, and availability of those websites. We do not, in any way, sponsor, recommend, or endorse anything contained on these websites. Responsibility for the content and privacy practices of these websites rests solely with the owners of those websites and not with us.

## 8. Website availability
We may change, suspend, discontinue, or restrict access to, the Website at any time (whether with respect to you or all users generally) without notice or liability to you. We take no responsibility for, and we are not liable for damage, losses (including loss of profit, income, or saving), costs or expenses of any kind, whether direct, indirect or consequential, howsoever arising, suffered or incurred by you due to, the website being unavailable for any reason.

## 9. Intellectual property
Any reference to "information" in these Terms includes all information on the Website (including all data, text, graphics, artwork, photographs, logos, icons, sound recordings, and videos) as well as any information linked from the Website.

All copyright and intellectual property rights in the information contained on the Website, and all rights to that intellectual property, are owned by us (or used with the approval of the relevant owner). Nothing on the Website grants, or should be construed as granting, you any licence to use any information (including, without limitation, trademarks or logos appearing on the Website) without our express written permission. Unless stated otherwise, you may access and download the materials located on the Website only for personal, non-commercial use or otherwise in relation to using or considering using any of the products or services we provide (whether through the Website or otherwise).

If you wish to link to any part of the Website, you must obtain our prior written consent.

## 10. Cookies
By using or accessing the Website, you are giving consent to us to use cookies to collect data about each visit to the Website. Cookies help us to analyse site usage more accurately. Most web browsers are set to accept cookies. If you do not wish to accept cookies, you can set your browser to refuse them or to warn you when you are about to receive one. Like most websites, we use cookies for a variety of purposes to improve your online experience, for analytics and for marketing.

## 11. Disclosure Statement
Please refer to our [Disclosure Statement](/disclosure-statement) for more information about our financial advice services.`,
  },
};
