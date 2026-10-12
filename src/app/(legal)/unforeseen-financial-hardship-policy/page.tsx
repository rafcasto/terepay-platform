import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'unforeseen-financial-hardship-policy';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function UnforeseenFinancialHardshipPolicyPage() {
  return <LegalDocumentPage slug={SLUG} />;
}
