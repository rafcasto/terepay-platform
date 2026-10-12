import LegalArticle, { legalMetadata } from '../_components/LegalArticle';

const SLUG = 'disclosure-statement';

export const metadata = legalMetadata(SLUG);

export default function DisclosureStatementPage() {
  return (
    <LegalArticle slug={SLUG} lead="Advice about your credit contract is not regulated financial advice.">
      <h2>You are protected by responsible lending laws</h2>
      <p>
        Because of these protections, the recommendations given to you about your application or account
        are not regulated financial advice. This means that duties and requirements imposed on people who
        give financial advice do not apply to these recommendations. This includes a duty to comply with a
        code of conduct and a requirement to be licensed.
      </p>
      <p className="tp-prose__note">
        © Terepay Neophile Limited {new Date().getFullYear()}. TEREPAY and the TerePay logo are registered
        trademarks of Terepay Neophile Limited. All rights reserved.
      </p>
    </LegalArticle>
  );
}
