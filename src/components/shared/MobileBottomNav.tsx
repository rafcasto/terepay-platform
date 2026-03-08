'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

export default function MobileBottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
            pathname === item.href || pathname.startsWith(item.href + '/')
              ? 'text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
