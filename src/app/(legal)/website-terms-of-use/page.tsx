import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'website-terms-of-use';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function WebsiteTermsOfUsePage() {
  return <LegalDocumentPage slug={SLUG} />;
}
