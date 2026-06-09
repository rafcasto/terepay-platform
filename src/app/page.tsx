import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/admin/site-settings';
import MaintenancePage from '@/components/shared/MaintenancePage';
import Navbar from './_landing/Navbar';
import HeroSection from './_landing/HeroSection';
import HowItWorksSection from './_landing/HowItWorksSection';
import FeaturesSection from './_landing/FeaturesSection';
import LoanSummaryCard from './_landing/LoanSummaryCard';
import PartnersSection from './_landing/PartnersSection';
import TestimonialsSection from './_landing/TestimonialsSection';
import FAQSection from './_landing/FAQSection';
import CTABanner from './_landing/CTABanner';
import Footer from './_landing/Footer';

export const metadata: Metadata = {
  title: 'TerePay — Borrow Now, Pay Later',
  description:
    'Experience the flexibility of accessing funds when you need them the most. Fast approval, transparent fees, responsible lending in New Zealand.',
  openGraph: {
    title: 'TerePay — Borrow Now, Pay Later',
    description:
      'TerePay connects borrowers with responsible, transparent short-term lending. Apply online — decisions within 24 hours.',
    url: 'https://terepay.com',
    siteName: 'TerePay',
    type: 'website',
  },
};

export default async function Home() {
  const settings = await getSiteSettings();
  if (settings.maintenanceMode.public) {
    return <MaintenancePage message={settings.maintenanceMessage} />;
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <LoanSummaryCard />
        <PartnersSection />
        <TestimonialsSection />
        <FAQSection />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
