import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'terms-and-conditions';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function TermsAndConditionsPage() {
  return <LegalDocumentPage slug={SLUG} />;
}
