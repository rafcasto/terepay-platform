import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'dispute-resolution-policy';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function DisputeResolutionPolicyPage() {
  return <LegalDocumentPage slug={SLUG} />;
}
