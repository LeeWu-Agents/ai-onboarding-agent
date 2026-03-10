import { randomUUID } from 'crypto';

// ─── In-Memory Store (Firestore-Ersatz für lokalen Test) ─────────────────────
// TODO: Für Cloud-Deployment durch firestore.ts ersetzen

interface Session {
  session_id: string;
  status: 'active' | 'complete';
  created_at: string;
}

interface Employee {
  employee_id: string;
  session_id: string;
  name: string;
  birth_date: string;
  role: string;
  team: string;
  start_date: string;
  created_at: string;
}

const sessions = new Map<string, Session>();
const employees = new Map<string, Employee>();

export function createSession(): Session {
  const session: Session = {
    session_id: randomUUID(),
    status: 'active',
    created_at: new Date().toISOString(),
  };
  sessions.set(session.session_id, session);
  return session;
}

export function saveEmployee(data: Omit<Employee, 'employee_id' | 'created_at'>): Employee {
  const employee: Employee = {
    ...data,
    employee_id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  employees.set(employee.employee_id, employee);
  return employee;
}

export function getEmployee(id: string): Employee | null {
  return employees.get(id) ?? null;
}

export function listEmployees(): Employee[] {
  return Array.from(employees.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function deleteEmployee(id: string): boolean {
  return employees.delete(id);
}

export function updateEmployee(id: string, data: Partial<Omit<Employee, 'employee_id' | 'session_id' | 'created_at'>>): Employee | null {
  const existing = employees.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...data };
  employees.set(id, updated);
  return updated;
}
