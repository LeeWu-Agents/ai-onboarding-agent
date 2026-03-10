'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEmployees, deleteEmployee, updateEmployee, saveEmployee, Employee } from '@/lib/api';
import { EmployeeData } from '@/lib/liveSession';
import EmployeeView from '@/components/EmployeeView';
import AgentBubble from '@/components/AgentBubble';

// ── CSV helpers ───────────────────────────────────────────────────────────────

const CSV_HEADERS = ['name', 'birth_date', 'role', 'team', 'start_date'];

function exportCSV(employees: Employee[]) {
  const rows = [CSV_HEADERS.join(','), ...employees.map((e) =>
    [e.name, e.birth_date, e.role, e.team, e.start_date]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(',')
  )];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Partial<EmployeeData>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? line.split(',');
    const clean = vals.map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = clean[i] ?? ''; });
    return {
      name: row['name'] ?? '',
      birth_date: row['birth_date'] ?? '',
      role: row['role'] ?? '',
      team: row['team'] ?? '',
      start_date: row['start_date'] ?? '',
    };
  }).filter((r) => r.name);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importPreview, setImportPreview] = useState<Partial<EmployeeData>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    getEmployees()
      .then(setEmployees)
      .catch(() => setError('Could not load employees.'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (editedData: EmployeeData) => {
    if (!selected) return;
    try {
      const updated = await updateEmployee(selected.employee_id, editedData);
      setEmployees((prev) => prev.map((e) => e.employee_id === updated.employee_id ? updated : e));
      setSelected(updated);
    } catch {
      alert('Failed to update employee.');
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteEmployee(selected.employee_id);
      setEmployees((prev) => prev.filter((e) => e.employee_id !== selected.employee_id));
      setSelected(null);
      setConfirmDelete(false);
    } catch {
      alert('Failed to delete employee.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(reader.result as string);
      setImportPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const results = await Promise.all(
        importPreview.map((row) =>
          saveEmployee({
            session_id: 'import',
            name: row.name ?? '',
            birth_date: row.birth_date ?? '',
            role: row.role ?? '',
            team: row.team ?? '',
            start_date: row.start_date ?? '',
          })
        )
      );
      setEmployees((prev) => [...results.map((r) => ({ ...r, created_at: new Date().toISOString() })), ...prev]);
      setImportPreview(null);
    } catch {
      alert('Import failed. Please check the CSV format.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
            <p className="text-gray-500 text-sm mt-0.5">All onboarded employees this session</p>
          </div>
          <div className="flex gap-2">
            {employees.length > 0 && (
              <button
                onClick={() => exportCSV(employees)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                ↓ Export CSV
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              ↑ Import CSV
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Onboard New
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && !error && employees.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            No employees onboarded yet.
          </div>
        )}

        {!loading && employees.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-5 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span>Name</span>
              <span>Date of Birth</span>
              <span>Role</span>
              <span>Team</span>
              <span>Start Date</span>
            </div>
            {employees.map((emp, i) => (
              <div
                key={emp.employee_id}
                onClick={() => setSelected(emp)}
                className={`grid grid-cols-5 px-5 py-3.5 text-sm items-center cursor-pointer hover:bg-blue-50 transition ${
                  i !== employees.length - 1 ? 'border-b border-gray-50' : ''
                } ${selected?.employee_id === emp.employee_id ? 'bg-blue-50' : ''}`}
              >
                <span className="font-medium text-gray-900">{emp.name}</span>
                <span className="text-gray-600">{emp.birth_date}</span>
                <span className="text-gray-600">{emp.role}</span>
                <span>
                  <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    {emp.team}
                  </span>
                </span>
                <span className="text-gray-600">{emp.start_date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

      {/* Import Preview */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Import Preview</p>
                <p className="text-gray-500 text-sm">{importPreview.length} employee{importPreview.length !== 1 ? 's' : ''} found in CSV</p>
              </div>
              <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="overflow-x-auto max-h-72">
              <div className="grid grid-cols-5 px-5 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Name</span><span>Date of Birth</span><span>Role</span><span>Team</span><span>Start Date</span>
              </div>
              {importPreview.map((row, i) => (
                <div key={i} className={`grid grid-cols-5 px-5 py-2.5 text-sm ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                  <span className="font-medium text-gray-900">{row.name || <span className="text-red-400">—</span>}</span>
                  <span className="text-gray-600">{row.birth_date || '—'}</span>
                  <span className="text-gray-600">{row.role || '—'}</span>
                  <span className="text-gray-600">{row.team || '—'}</span>
                  <span className="text-gray-600">{row.start_date || '—'}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setImportPreview(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                Cancel
              </button>
              <button onClick={handleImportConfirm} disabled={importing} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {importing ? 'Importing…' : `↑ Import ${importPreview.length} Employee${importPreview.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Detail Overlay */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <EmployeeView
              employee={selected}
              mode="saved"
              onConfirm={handleUpdate}
              onDiscard={() => setSelected(null)}
              onReset={() => setSelected(null)}
              onBack={() => setSelected(null)}
              onDelete={() => setConfirmDelete(true)}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm text-center">
            <p className="text-gray-900 font-semibold mb-1">Delete Employee?</p>
            <p className="text-gray-500 text-sm mb-6">
              <strong>{selected.name}</strong> will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition">
                ✕ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <AgentBubble />
    </main>
  );
}
