import { Router } from 'express';
import { saveEmployee, getEmployee, listEmployees, deleteEmployee, updateEmployee } from '../services/store.js';

const router = Router();

router.post('/', (req, res) => {
  const { session_id, name, birth_date, role, team, start_date } = req.body;
  if (!session_id || !name || !role || !team || !start_date) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const employee = saveEmployee({ session_id, name, birth_date, role, team, start_date });
  res.json(employee);
});

router.get('/', (_req, res) => {
  res.json(listEmployees());
});

router.get('/:id', (req, res) => {
  const employee = getEmployee(req.params.id);
  if (!employee) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(employee);
});

router.put('/:id', (req, res) => {
  const { name, birth_date, role, team, start_date } = req.body;
  const updated = updateEmployee(req.params.id, { name, birth_date, role, team, start_date });
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const deleted = deleteEmployee(req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
