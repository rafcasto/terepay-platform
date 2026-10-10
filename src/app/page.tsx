import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/admin/site-settings';
import { getContentSections } from '@/lib/content/site-content';
import MaintenancePage from '@/components/shared/MaintenancePage';
import Navbar from './_landing/Navbar';
import HeroSection from './_landing/HeroSection';
import PartnersSection from './_landing/PartnersSection';
import UsesSection from './_landing/UsesSection';
import CalculatorSection from './_landing/CalculatorSection';
import ApplySection from './_landing/ApplySection';
import TestimonialsSection from './_landing/TestimonialsSection';
import CTABanner from './_landing/CTABanner';
import FAQSection from './_landing/FAQSection';
import Footer from './_landing/Footer';

export const metadata: Metadata = {
  title: 'TerePay — Borrow Now, Pay Later',
  description:
    'Experience the flexibility of accessing funds when you need them the most. Fast approval, transparent fees, responsible lending in New Zealand.',
  openGraph: {
    title: 'TerePay — Borrow Now, Pay Later',
    description:
      'TerePay connects borrowers with responsible, transparent short-term lending. Apply online — decisions within 24–48 hours.',
    url: 'https://terepay.com',
    siteName: 'TerePay',
    type: 'website',
  },
};

// The landing page is gated by maintenance mode, which is read from Firestore
// per request — force dynamic rendering so the flag is never frozen at build time.
export const dynamic = 'force-dynamic';

const SECTION_KEYS = [
  'landing.hero',
  'landing.uses',
  'landing.calculator',
  'landing.apply',
  'landing.cta',
  'landing.faq',
] as const;

export default async function Home() {
  const settings = await getSiteSettings();
  if (settings.maintenanceMode.public) {
    return <MaintenancePage message={settings.maintenanceMessage} />;
  }

  const content = await getContentSections(SECTION_KEYS);

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface-card font-brand text-[var(--ink-800)]">
      <Navbar />
      <main>
        <HeroSection content={content['landing.hero']} />
        <PartnersSection />
        <UsesSection content={content['landing.uses']} />
        <CalculatorSection content={content['landing.calculator']} />
        <ApplySection content={content['landing.apply']} />
        <TestimonialsSection />
        <CTABanner content={content['landing.cta']} />
        <FAQSection content={content['landing.faq']} />
      </main>
      <Footer />
    </div>
  );
}
