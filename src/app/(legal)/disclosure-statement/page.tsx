import LegalDocumentPage, { legalPageMetadata } from '../_components/LegalDocumentPage';

const SLUG = 'disclosure-statement';

export const generateMetadata = () => legalPageMetadata(SLUG);

export default function DisclosureStatementPage() {
  return <LegalDocumentPage slug={SLUG} />;
}
