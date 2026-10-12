import LegalArticle, { legalMetadata } from '../_components/LegalArticle';

const SLUG = 'dispute-resolution-policy';

export const metadata = legalMetadata(SLUG);

export default function DisputeResolutionPolicyPage() {
  return (
    <LegalArticle
      slug={SLUG}
      lead="If you are unhappy with your experience with TerePay, we want to know about it."
    >
      <h2>How to make a complaint</h2>
      <p>The best way to make a complaint is to get in touch with TerePay through the contact methods below.</p>
      <ul>
        <li>
          Phone (call or text): <a href="tel:+64221358538">+64 22 135 8538</a>
        </li>
        <li>
          Email: <a href="mailto:info@terepay.com">info@terepay.com</a>
        </li>
      </ul>
      <p>We will try to resolve your complaint to your satisfaction.</p>

      <h2>Independent dispute resolution</h2>
      <p>
        If you are not satisfied with our decision about your complaint you can refer the complaint to our
        independent external dispute resolution scheme, Financial Services Complaints Ltd (FSCL). It is
        free to make a complaint to FSCL. FSCL may help you to resolve any disagreements you have with us
        free of charge. FSCL&rsquo;s contact details are:
      </p>
      <ul>
        <li>
          Phone: <a href="tel:0800347257">0800 347 257</a>
        </li>
        <li>
          Website:{' '}
          <a href="https://www.fscl.org.nz/" target="_blank" rel="noopener noreferrer">
            www.fscl.org.nz
          </a>
        </li>
        <li>
          Email: <a href="mailto:complaints@fscl.org.nz">complaints@fscl.org.nz</a>
        </li>
      </ul>
    </LegalArticle>
  );
}
