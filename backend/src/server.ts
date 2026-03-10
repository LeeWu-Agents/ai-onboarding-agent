import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import sessionRoutes from './routes/sessions.js';
import employeeRoutes from './routes/employees.js';
import contractRoutes from './routes/contract.js';
import { AgentSession } from './services/agentSession.js';

const app = express();
const port = process.env.PORT ?? 3001;
const apiKey = process.env.GEMINI_API_KEY ?? '';

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/session', sessionRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/contract', contractRoutes);

// ─── WebSocket Server ─────────────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/agent' });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  const session = new AgentSession(ws, apiKey);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      await session.handleMessage(msg);
    } catch (err) {
      console.error('[WS] Error:', err);
      ws.send(JSON.stringify({ type: 'error', text: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    session.close();
  });
});

server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`WebSocket ready on ws://localhost:${port}/ws/agent`);
});
