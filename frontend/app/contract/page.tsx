'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { generateContract } from '@/lib/api';

function ContractContent() {
  const params = useSearchParams();
  const router = useRouter();

  const employee = {
    name: params.get('name') ?? '',
    birth_date: params.get('birth_date') ?? '',
    role: params.get('role') ?? '',
    team: params.get('team') ?? '',
    start_date: params.get('start_date') ?? '',
  };

  const [contract, setContract] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!employee.name) { setError('Missing employee data.'); setLoading(false); return; }
    generateContract(employee)
      .then((r) => setContract(r.contract))
      .catch(() => setError('Failed to generate contract. Please try again.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    const blob = new Blob([contract], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${employee.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Employment Contract</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Generated for <strong>{employee.name}</strong> · {employee.role} · {employee.team}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-gray-500 text-sm hover:text-gray-700 transition"
          >
            ← Back
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center gap-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Agent is drafting the contract…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-10">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={() => router.back()} className="text-blue-600 text-sm underline">
              Go back
            </button>
          </div>
        )}

        {/* Contract */}
        {!loading && !error && contract && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm font-medium text-gray-700">Contract ready</span>
              </div>
              <button
                onClick={handleDownload}
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                ↓ Download .txt
              </button>
            </div>

            {/* Contract text */}
            <pre className="px-6 py-6 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
              {contract}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ContractPage() {
  return (
    <Suspense>
      <ContractContent />
    </Suspense>
  );
}
