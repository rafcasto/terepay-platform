'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const dashboardHref = user?.role === 'lender' ? '/lender/dashboard' : '/applicant/dashboard';

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href={user ? dashboardHref : '/'} className="flex items-center gap-2">
            <span className="text-[#F5A523] font-bold text-xl">TerePay</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user.firstName} {user.lastName}
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FEF7E9] text-[#E08B00] capitalize">
                  {user.role}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm bg-[#F5A523] text-white px-4 py-2 rounded-md hover:bg-[#E08B00] transition-colors"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
