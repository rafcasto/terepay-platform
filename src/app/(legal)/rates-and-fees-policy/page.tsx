import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'rates-and-fees-policy';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function RatesAndFeesPolicyPage() {
  return <LegalDocumentPage slug={SLUG} />;
}
