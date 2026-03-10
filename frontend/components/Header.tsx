import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image
            src="/signet.png"
            alt="Kropf Systems"
            width={28}
            height={28}
            className="object-contain"
          />
          <div>
            <span className="text-sm font-bold text-gray-800 tracking-wide">Kropf Systems</span>
            <span className="hidden sm:inline text-gray-300 mx-2">|</span>
            <span className="hidden sm:inline text-sm text-gray-400">AI Onboarding Agent</span>
          </div>
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
