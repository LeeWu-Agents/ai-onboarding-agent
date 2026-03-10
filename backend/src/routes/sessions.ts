import { Router } from 'express';
import { createSession } from '../services/store.js';

const router = Router();

router.post('/', (_req, res) => {
  const session = createSession();
  res.json({ session_id: session.session_id });
});

export default router;
