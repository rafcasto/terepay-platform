import Link from 'next/link';
import LegalArticle, { legalMetadata } from '../_components/LegalArticle';

const SLUG = 'website-terms-of-use';

export const metadata = legalMetadata(SLUG);

export default function WebsiteTermsOfUsePage() {
  return (
    <LegalArticle slug={SLUG} lead="Please read these terms carefully before continuing to use or browse the website.">
      <p>
        The website{' '}
        <Link href="/">https://terepay.com/</Link> (Website) is owned and maintained by TerePay Neophile Limited
        (we, us, our). Please read these terms of use (Terms) carefully before continuing to use or browse the
        Website. By accessing and using the Website you are deemed to have accepted these Terms and agreed to
        be bound by them.
      </p>
      <p>
        Our current <Link href="/privacy-policy">Privacy Policy</Link> forms part of these Terms. These Terms
        (including the Privacy Policy) form the entire agreement between us and you relating to your access to
        and use of the Website.
      </p>
      <p>
        We reserve the right to change or modify the Terms at any time, without giving you prior notice. Any
        change will take effect once posted on the Website.
      </p>

      <h2>1. About this Website</h2>
      <p>
        The Website is not an offer to provide products or services to you and any communication you send to
        us does not impose any obligation on us.
      </p>
      <p>
        The information on the Website is general information only, is not advice, is not an endorsement or
        recommendation of any kind including regarding the value or suitability of any particular course of
        action or transaction. The calculators on the Website and their results are not a recommendation to
        borrow or confirmation that we will provide you with a loan. We recommend you seek appropriate advice
        (including personalised financial advice) from relevant qualified professionals that suit your
        circumstances.
      </p>

      <h2>2. Our products and services</h2>
      <p>
        Our products and services are provided to New Zealand residents only. Applications for credit are
        subject to responsible lender checks and our credit criteria.
      </p>

      <h2>3. No warranties</h2>
      <p>
        To the maximum extent permitted by law, we make no representations, warranties, and guarantees of any
        kind (express or implied) including (without limitation) about the accuracy, reliability,
        completeness, suitability or availability of the Website or the information contained on the Website
        (including the results from the loan calculators).
      </p>
      <p>
        The information on the Website is subject to change at any time and may, at times, be out of date,
        inaccurate and/or incomplete.
      </p>
      <p>
        To the maximum extent permitted by law, we are under no obligation, and we accept no responsibility,
        to update any information (including the results from the loan calculators) on the Website or to
        correct any errors in the information after it is published on the Website, nor do we accept any
        liability for any failure to do so.
      </p>
      <p>
        Any reference to historical information and performance of a product or service may not necessarily
        be a good guide to future performance. You are solely responsible for any actions you take or do not
        take by relying on such information.
      </p>

      <h2>4. No liability</h2>
      <p>
        To the maximum extent permitted by law, we and our directors, contractors, business associates,
        consultants and staff are not liable for any damage, losses (including loss of profit, income, or
        saving), costs or expenses of any kind, whether direct, indirect or consequential, howsoever arising,
        suffered or incurred by you in connection with your access to or use of the Website or the
        information on or accessed from or through the Website (including the content of other websites
        accessed from our Website). Nothing in these Terms has the effect of contracting out of your rights
        under the Consumer Guarantees Act 1993 or other consumer protection law that cannot be contracted out
        of. However, if you are using the Website or its content in trade, the Consumer Guarantees Act 1993
        will not apply to you and you agree and confirm that it is fair and reasonable that the Act does not
        apply to you.
      </p>

      <h2>5. Jurisdiction &amp; governing law</h2>
      <p>
        The information is only intended for persons in New Zealand and is not intended for persons outside
        New Zealand. The laws of New Zealand shall govern your use of the Website and you agree to submit to
        the non-exclusive jurisdiction of the New Zealand courts. To the maximum extent permitted by law, we
        are not responsible or liable for any failure of the Website to comply with the laws of any other
        country.
      </p>

      <h2>6. Virus protection</h2>
      <p>
        We do not guarantee that the Website will always be secure and free of viruses or bugs, or will be
        accessible without any interruption. You acknowledge that it is your responsibility to implement
        sufficient procedures and virus checks (including anti-virus and other security checks).
      </p>

      <h2>7. Linked websites</h2>
      <p>
        The Website may contain links to other websites. These websites are neither under the control of, nor
        monitored by us and we have no knowledge of or control over the nature, content, and availability of
        those websites. We do not, in any way, sponsor, recommend, or endorse anything contained on these
        websites. Responsibility for the content and privacy practices of these websites rests solely with
        the owners of those websites and not with us.
      </p>

      <h2>8. Website availability</h2>
      <p>
        We may change, suspend, discontinue, or restrict access to, the Website at any time (whether with
        respect to you or all users generally) without notice or liability to you. We take no responsibility
        for, and we are not liable for damage, losses (including loss of profit, income, or saving), costs or
        expenses of any kind, whether direct, indirect or consequential, howsoever arising, suffered or
        incurred by you due to, the website being unavailable for any reason.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        Any reference to &ldquo;information&rdquo; in these Terms includes all information on the Website
        (including all data, text, graphics, artwork, photographs, logos, icons, sound recordings, and videos)
        as well as any information linked from the Website.
      </p>
      <p>
        All copyright and intellectual property rights in the information contained on the Website, and all
        rights to that intellectual property, are owned by us (or used with the approval of the relevant
        owner). Nothing on the Website grants, or should be construed as granting, you any licence to use any
        information (including, without limitation, trademarks or logos appearing on the Website) without our
        express written permission. Unless stated otherwise, you may access and download the materials located
        on the Website only for personal, non-commercial use or otherwise in relation to using or considering
        using any of the products or services we provide (whether through the Website or otherwise).
      </p>
      <p>If you wish to link to any part of the Website, you must obtain our prior written consent.</p>

      <h2>10. Cookies</h2>
      <p>
        By using or accessing the Website, you are giving consent to us to use cookies to collect data about
        each visit to the Website. Cookies help us to analyse site usage more accurately. Most web browsers are
        set to accept cookies. If you do not wish to accept cookies, you can set your browser to refuse them or
        to warn you when you are about to receive one. Like most websites, we use cookies for a variety of
        purposes to improve your online experience, for analytics and for marketing.
      </p>

      <h2>11. Disclosure Statement</h2>
      <p>
        Please refer to our <Link href="/disclosure-statement">Disclosure Statement</Link> for more
        information about our financial advice services.
      </p>
    </LegalArticle>
  );
}
