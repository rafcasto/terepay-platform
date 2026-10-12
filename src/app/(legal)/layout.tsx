import Navbar from '@/app/_landing/Navbar';
import Footer from '@/app/_landing/Footer';

// Legal documents are editable in the content editor and read from Firestore
// per request — never freeze them at build time.
export const dynamic = 'force-dynamic';

/**
 * Shared chrome for the public legal / compliance pages (privacy policy,
 * terms, fees, hardship, complaints, disclosure). Reuses the landing-page
 * navbar and footer so these pages read as part of the marketing site.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[var(--surface-page)] font-brand text-[var(--text-body)]">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
