import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

router.post('/', async (req, res) => {
  const { name, birth_date, role, team, start_date } = req.body;
  if (!name || !role || !team || !start_date) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a professional legal document assistant. Generate a formal employment contract for a wellness studio.

Employee details:
- Full Name: ${name}
- Date of Birth: ${birth_date ?? 'Not specified'}
- Position: ${role}
- Department/Team: ${team}
- Start Date: ${start_date}

Write a complete, professional employment contract with these sections:
1. PARTIES
2. POSITION AND DUTIES
3. START DATE AND PROBATIONARY PERIOD (3 months standard)
4. WORKING HOURS (40 hours per week)
5. COMPENSATION (amount to be confirmed separately)
6. RESPONSIBILITIES
7. CONFIDENTIALITY
8. TERMINATION (1 month notice period)
9. GOVERNING LAW

Use formal language. Plain text only — no markdown. Section headers in UPPERCASE. Keep it concise but legally complete.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const contract = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    res.json({ contract });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
