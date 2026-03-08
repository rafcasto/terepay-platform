import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 to-white">
      <header className="px-8 py-5 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <span className="text-xl font-bold text-indigo-600">TerePay</span>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Sign In
          </Link>
          <Link href="/auth/signup" className="text-sm font-medium px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
            Get Started
          </Link>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center py-24">
        <h1 className="text-5xl font-extrabold text-gray-900 max-w-2xl leading-tight">
          Lending made <span className="text-indigo-600">simple</span> and{' '}
          <span className="text-indigo-600">transparent</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl">
          TerePay connects borrowers with lenders through a secure, streamlined platform.
          Apply in minutes. Get funded fast.
        </p>
        <div className="mt-10 flex gap-4">
          <Link href="/auth/signup" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow">
            Apply for a Loan
          </Link>
          <Link href="/auth/login" className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
            Sign In
          </Link>
        </div>
        <div className="mt-24 grid grid-cols-3 gap-8 max-w-3xl w-full text-left">
          {[
            { title: 'Fast Approval', body: 'Submit your application and receive a decision in as little as 24 hours.' },
            { title: 'Secure by Design', body: 'End-to-end encryption and strict role-based access protect your data.' },
            { title: 'Transparent Terms', body: 'No hidden fees. Clear repayment schedules from day one.' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="px-8 py-6 text-center text-xs text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} TerePay. All rights reserved.
      </footer>
    </div>
  );
}
