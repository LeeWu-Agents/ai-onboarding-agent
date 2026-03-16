export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-gray-100 py-4 px-6" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Demo uses synthetic test documents. No real personal data is stored.
        </span>
        <a
          href="https://kropfsystems.ch"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          © 2026 Kropf Systems
        </a>
      </div>
    </footer>
  );
}
