import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import MobileBottomNav from '@/components/shared/MobileBottomNav';

const NAV_ITEMS = [
  { href: '/lender/dashboard', label: 'Dashboard' },
  { href: '/lender/applications', label: 'Applications' },
  { href: '/lender/customers', label: 'Customers' },
  { href: '/lender/portfolio', label: 'Portfolio' },
  { href: '/lender/profile', label: 'Profile' },
];

export default async function LenderLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') redirect('/auth/login');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile top header */}
      <header className="sm:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#F5A523]">TerePay</span>
          <span className="text-xs font-medium text-gray-400">Lender</span>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-60 bg-white border-r border-gray-200 flex-col shrink-0">
          <div className="px-6 py-5 border-b border-gray-100">
            <span className="text-lg font-bold text-[#F5A523]">TerePay</span>
            <span className="ml-2 text-xs font-medium text-gray-400">Lender</span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-[#FEF7E9] hover:text-[#E08B00] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="px-3 py-4 border-t border-gray-100">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-sm font-medium text-gray-500 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </aside>

        {/* Main — extra bottom padding on mobile so bottom nav doesn't overlap */}
        <main className="flex-1 overflow-auto pb-16 sm:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav items={NAV_ITEMS} />
    </div>
  );
}
