'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeData } from '@/lib/liveSession';

function flashClick(e: React.MouseEvent) {
  const el = e.currentTarget as HTMLElement;
  el.classList.remove('click-flash');
  void el.offsetWidth;
  el.classList.add('click-flash');
}

const ROLES = ['Therapist', 'Receptionist', 'Manager', 'Other'];
const TEAMS = ['Therapy', 'Reception', 'Management'];

interface Props {
  employee: EmployeeData;
  mode: 'preview' | 'saved';
  onConfirm: (data: EmployeeData) => void;
  onDiscard: () => void;
  onReset: () => void;
  onDelete?: () => void;
  onBack?: () => void;
}

export default function EmployeeView({ employee, mode, onConfirm, onDiscard, onReset, onDelete, onBack }: Props) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (mode === 'saved') {
      window.dispatchEvent(new CustomEvent('agentProactiveEmployee', { detail: { employee } }));
    }
  }, []);
  const [draft, setDraft] = useState<EmployeeData>(employee);
  const [contractDeclined, setContractDeclined] = useState(false);
  const router = useRouter();

  const goToContract = () => {
    const params = new URLSearchParams({
      name: employee.name,
      birth_date: employee.birth_date,
      role: employee.role,
      team: employee.team,
      start_date: employee.start_date,
    });
    router.push(`/contract?${params.toString()}`);
  };

  // ── Edit mode (must come before saved/preview checks) ─────────────────────
  if (editing) {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
          <span className="text-amber-700 font-semibold text-sm">✎ Edit Profile</span>
        </div>
        <div className="px-6 py-5 space-y-3">
          <EditText
            label="Name"
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
          />
          <EditText
            label="Date of Birth"
            value={draft.birth_date}
            placeholder="DD.MM.YYYY"
            onChange={(v) => setDraft((d) => ({ ...d, birth_date: v }))}
          />
          <EditSelect
            label="Role"
            value={draft.role}
            options={ROLES}
            onChange={(v) => setDraft((d) => ({ ...d, role: v }))}
          />
          <EditSelect
            label="Team"
            value={draft.team}
            options={TEAMS}
            onChange={(v) => setDraft((d) => ({ ...d, team: v }))}
          />
          <EditText
            label="Start Date"
            value={draft.start_date}
            placeholder="DD.MM.YYYY"
            onChange={(v) => setDraft((d) => ({ ...d, start_date: v }))}
          />
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(draft); setEditing(false); }}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition"
          >
            ✓ Save & Confirm
          </button>
        </div>
      </div>
    );
  }

  // ── Saved (success) ────────────────────────────────────────────────────────
  if (mode === 'saved') {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">✓</span>
            <span className="text-green-700 font-semibold">Employee Successfully Onboarded</span>
          </div>
          <button
            onClick={() => { setDraft(employee); setEditing(true); }}
            className="text-sm text-amber-600 hover:text-amber-700 font-medium transition"
          >
            ✎ Edit
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <Row label="Name" value={employee.name} />
          <Row label="Date of Birth" value={employee.birth_date} />
          <Row label="Role" value={employee.role} />
          <Row label="Team" value={employee.team} />
          <Row label="Start Date" value={employee.start_date} />
        </div>
        {/* Agent contract offer */}
        {!contractDeclined && (
          <div className="mx-6 mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-sm text-blue-800 mb-3">
              <span className="font-medium">Agent:</span> Would you like me to create an employment contract for <strong>{employee.name}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={goToContract}
                className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Yes, please
              </button>
              <button
                onClick={() => setContractDeclined(true)}
                className="bg-gray-100 text-gray-600 text-sm px-4 py-1.5 rounded-lg hover:bg-gray-200 transition"
              >
                No, thanks
              </button>
            </div>
          </div>
        )}

        <div className="px-6 pb-5 flex gap-3 flex-wrap">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              ← Back to List
            </button>
          ) : (
            <button
              onClick={onReset}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Onboard Another
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="bg-red-50 text-red-600 py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-red-100 transition"
            >
              ✕ Delete
            </button>
          )}
          {!onBack && (
            <button
              onClick={() => router.push('/employees')}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              View Employees
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Preview mode ───────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
        <span className="text-blue-700 font-semibold text-sm">Profile Preview — please review before confirming</span>
      </div>
      <div className="px-6 py-5 space-y-3">
        <Row label="Name" value={employee.name} />
        <Row label="Date of Birth" value={employee.birth_date} />
        <Row label="Role" value={employee.role} />
        <Row label="Team" value={employee.team} />
        <Row label="Start Date" value={employee.start_date} />
      </div>
      <div className="px-6 pb-5 flex gap-3">
        <button
          onClick={(e) => { flashClick(e); onDiscard(); }}
          className="bg-gray-100 text-gray-500 py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 transition"
        >
          ✕ Discard
        </button>
        <button
          onClick={(e) => { flashClick(e); setEditing(true); }}
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-50 hover:text-amber-700 transition"
        >
          ✎ Edit
        </button>
        <button
          onClick={(e) => { flashClick(e); onConfirm(employee); }}
          className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition"
        >
          ✓ Confirm
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-900 text-sm font-medium">{value}</span>
    </div>
  );
}

function EditText({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 text-sm w-28 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function EditSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 text-sm w-28 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}
