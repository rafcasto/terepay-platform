import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'annual-interest-rate';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function AnnualInterestRatePage() {
  return <LegalDocumentPage slug={SLUG} />;
}
