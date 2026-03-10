const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Employee {
  employee_id: string;
  name: string;
  birth_date: string;
  role: string;
  team: string;
  start_date: string;
  created_at: string;
}

export async function createSession(): Promise<{ session_id: string }> {
  const res = await fetch(`${API_URL}/api/session`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function saveEmployee(data: {
  session_id: string;
  name: string;
  birth_date: string;
  role: string;
  team: string;
  start_date: string;
}): Promise<{ employee_id: string; name: string; role: string; team: string; start_date: string }> {
  const res = await fetch(`${API_URL}/api/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save employee');
  return res.json();
}

export async function getEmployees(): Promise<Employee[]> {
  const res = await fetch(`${API_URL}/api/employees`);
  if (!res.ok) throw new Error('Failed to load employees');
  return res.json();
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/employees/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete employee');
}

export async function updateEmployee(id: string, data: {
  name: string;
  birth_date: string;
  role: string;
  team: string;
  start_date: string;
}): Promise<Employee> {
  const res = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update employee');
  return res.json();
}

export async function generateContract(data: {
  name: string;
  birth_date: string;
  role: string;
  team: string;
  start_date: string;
}): Promise<{ contract: string }> {
  const res = await fetch(`${API_URL}/api/contract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to generate contract');
  return res.json();
}
