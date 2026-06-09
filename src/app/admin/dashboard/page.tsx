import { adminDb } from '@/lib/firebase/admin';
import { getSiteSettings } from '@/lib/admin/site-settings';

async function getStats() {
  const [usersSnap, , templatesSnap] = await Promise.all([
    adminDb.collection('users').where('role', '==', 'lender').get(),
    adminDb.collection('loanApplications').orderBy('timeline.createdAt', 'desc').limit(1).get(),
    adminDb.collection('emailTemplates').get(),
  ]);

  const [allAppsSnap, applicantSnap] = await Promise.all([
    adminDb.collection('loanApplications').get(),
    adminDb.collection('users').where('role', '==', 'applicant').get(),
  ]);

  return {
    lenderCount: usersSnap.size,
    applicantCount: applicantSnap.size,
    applicationCount: allAppsSnap.size,
    templateCount: templatesSnap.size,
  };
}

export default async function AdminDashboardPage() {
  const [stats, settings] = await Promise.all([getStats(), getSiteSettings()]);

  const maintenanceActive =
    settings.maintenanceMode.public ||
    settings.maintenanceMode.applicants ||
    settings.maintenanceMode.lenders;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">TerePay platform overview</p>
      </div>

      {maintenanceActive && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Maintenance mode is active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {[
                settings.maintenanceMode.public && 'Public site',
                settings.maintenanceMode.applicants && 'Applicant portal',
                settings.maintenanceMode.lenders && 'Lender portal',
              ]
                .filter(Boolean)
                .join(', ')}{' '}
              {maintenanceActive ? 'is currently in maintenance mode.' : ''}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Lenders', value: stats.lenderCount, href: '/admin/users' },
          { label: 'Applicants', value: stats.applicantCount, href: '/admin/applications' },
          { label: 'Applications', value: stats.applicationCount, href: '/admin/applications' },
          { label: 'Email Templates', value: stats.templateCount, href: '/admin/email-templates' },
        ].map((stat) => (
          <a
            key={stat.label}
            href={stat.href}
            className="tp-card p-5 hover:shadow-lg transition-shadow group"
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
            <p className="font-tabular text-3xl font-semibold text-[#16263B] mt-1 group-hover:text-[#F08000] transition-colors">
              {stat.value.toLocaleString()}
            </p>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="tp-card p-5">
          <h2 className="font-semibold text-[#16263B] text-sm mb-4">Portal Status</h2>
          <div className="space-y-3">
            {[
              { label: 'Public Site', on: settings.maintenanceMode.public },
              { label: 'Applicant Portal', on: settings.maintenanceMode.applicants },
              { label: 'Lender Portal', on: settings.maintenanceMode.lenders },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    item.on
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${item.on ? 'bg-amber-500' : 'bg-green-500'}`} />
                  {item.on ? 'Maintenance' : 'Online'}
                </span>
              </div>
            ))}
          </div>
          <a
            href="/admin/settings"
            className="mt-4 block text-xs font-medium text-[#B45600] hover:underline"
          >
            Manage settings
          </a>
        </div>

        <div className="tp-card p-5">
          <h2 className="font-semibold text-[#16263B] text-sm mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Create lender account', href: '/admin/users' },
              { label: 'Manage email templates', href: '/admin/email-templates' },
              { label: 'Update integration keys', href: '/admin/config' },
              { label: 'Reassign applications', href: '/admin/applications' },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <span className="text-sm text-slate-700 group-hover:text-[#16263B]">{action.label}</span>
                <svg className="h-4 w-4 text-slate-400 group-hover:text-[#F08000] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
