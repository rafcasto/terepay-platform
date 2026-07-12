import ContentEditor from '../_components/ContentEditor';

export const dynamic = 'force-dynamic';

export default function BorrowerContentPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Borrower page content</h1>
        <p className="mt-1 text-sm text-slate-500">
          Copy shown to signed-in borrowers. Saves are live immediately.
        </p>
      </div>
      <ContentEditor group="borrower" />
    </div>
  );
}
