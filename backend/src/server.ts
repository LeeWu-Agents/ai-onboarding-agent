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
import { ChatSession } from './services/chatSession.js';

const app = express();
const port = process.env.PORT ?? 3001;
const apiKey = process.env.GEMINI_API_KEY ?? '';

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/session', sessionRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/contract', contractRoutes);

// ─── WebSocket Servers ────────────────────────────────────────────────────────
// Use noServer + manual upgrade routing so both paths can share the same HTTP server.

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const chatWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws/agent') {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  } else if (pathname === '/ws/chat') {
    chatWss.handleUpgrade(request, socket, head, (ws) => chatWss.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

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

chatWss.on('connection', (ws) => {
  console.log('[Chat WS] Client connected');
  const session = new ChatSession(ws, apiKey);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'message' && msg.text) {
        await session.handleMessage(msg.text, msg.path);
      }
    } catch (err) {
      console.error('[Chat WS] Error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[Chat WS] Client disconnected');
    session.close();
  });
});

server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`WebSocket ready on ws://localhost:${port}/ws/agent`);
});
