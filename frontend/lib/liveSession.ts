'use client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeData {
  name: string;
  birth_date: string;
  role: string;
  team: string;
  start_date: string;
}

export interface AgentMessage {
  type: 'chunk' | 'turn_complete' | 'complete' | 'error' | 'status';
  text?: string;
  employee?: EmployeeData;
}

export type MessageHandler = (message: AgentMessage) => void;

// ─── Image Compression (Latenzstrategie) ─────────────────────────────────────

export async function compressImage(
  base64: string,
  mimeType: string,
  maxDim = 800,
  quality = 0.70,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ─── Session ─────────────────────────────────────────────────────────────────

export class OnboardingSession {
  private ws: WebSocket | null = null;
  private onMessage: MessageHandler;
  private buffer = '';

  constructor(onMessage: MessageHandler) {
    this.onMessage = onMessage;
  }

  async start(imageBase64: string, mimeType: string): Promise<void> {
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
      .replace(/^http/, 'ws') + '/ws/agent';

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // Bild komprimiert senden
      compressImage(imageBase64, mimeType).then(({ base64, mimeType: mime }) => {
        this.send({ type: 'start', imageBase64: base64, mimeType: mime });
      });
    };

    this.ws.onmessage = (event) => this.handleEvent(JSON.parse(event.data));
    this.ws.onerror = () => this.onMessage({ type: 'error', text: 'Connection error.' });
    this.ws.onclose = (e) => {
      if (e.code !== 1000) {
        console.warn('[Session] WS closed unexpectedly:', e.code, e.reason);
      }
    };
  }

  sendText(text: string): void {
    this.send({ type: 'message', text });
    // Interrupt: Frontend zeigt sofort "processing" an
    this.onMessage({ type: 'status', text: '' });
  }

  close(): void {
    this.ws?.close(1000);
    this.ws = null;
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleEvent(event: AgentMessage): void {
    switch (event.type) {
      case 'chunk':
        this.buffer += event.text ?? '';
        // JSON-Block aus der Anzeige herausfiltern
        const display = this.buffer.replace(/\{"status":"complete"[\s\S]*$/, '').trim();
        this.onMessage({ type: 'chunk', text: display });
        break;

      case 'turn_complete':
        this.buffer = '';
        break;

      case 'complete':
        this.buffer = '';
        this.onMessage({ type: 'complete', employee: event.employee });
        break;

      case 'error':
        this.buffer = '';
        this.onMessage({ type: 'error', text: event.text ?? 'Unknown error' });
        break;
    }
  }
}
