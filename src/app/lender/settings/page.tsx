import QippayIntegrationCard from './QippayIntegrationCard';

export default function SettingsPage() {
  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage integrations and platform configuration.</p>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Integrations
        </h2>
        <QippayIntegrationCard />
      </section>
    </div>
  );
}
