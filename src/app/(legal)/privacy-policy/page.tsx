import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'privacy-policy';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage slug={SLUG} />;
}
