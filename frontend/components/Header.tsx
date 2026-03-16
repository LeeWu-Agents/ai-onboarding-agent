import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <span className="text-sm font-bold text-gray-800 tracking-wide">AI Onboarding Agent</span>
        </Link>
        <Link
          href="/employees"
          className="text-sm text-gray-500 hover:text-blue-600 transition-colors font-medium"
        >
          View Employees
        </Link>
      </div>
    </header>
  );
}
