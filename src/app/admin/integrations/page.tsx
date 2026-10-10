import QippayIntegrationCard from './QippayIntegrationCard';

export default function AdminIntegrationsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Integrations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Platform-wide payment and service integrations. Changes here affect every lender.
        </p>
      </div>

      <section className="space-y-4">
        <QippayIntegrationCard />
      </section>
    </div>
  );
}
