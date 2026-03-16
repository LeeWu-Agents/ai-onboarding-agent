import { GoogleGenAI } from '@google/genai';
import type { WebSocket } from 'ws';
import { listEmployees } from './store.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatWsEvent {
  type: 'chunk' | 'turn_complete' | 'error' | 'action';
  text?: string;
  action?: string;
  path?: string;
}

type Part = { text: string };
type Turn = { role: 'user' | 'model'; parts: Part[] };

// ─── System Instruction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are an AI assistant built into an employee onboarding application for a wellness studio.
You help HR staff manage employees and use the app.

## What you can do
- Answer questions about the onboarded employees (using the data below)
- Guide users to start a new onboarding
- Navigate the user to the right page
- Explain how the app works

## Navigation
When the user wants to navigate or start an action, end your response with one of these tags on its own line.
Do NOT say "click here" or "please go to" — just say what you are doing and let the navigation happen automatically.

[NAV:/] — navigates to home page and opens the document scanner
[NAV:/employees] — navigates to the employee list
[NAV:/contract] — navigates to the contract page

Only include a NAV tag when navigation is clearly needed.

## Current Employee Data
{EMPLOYEE_DATA}

## Rules
- Be concise: 1–2 sentences per response
- Do not use markdown formatting
- Do not invent employee data — only use what is listed above
- If asked to do something impossible from this interface, explain and guide them to the right place`;

// ─── Chat Session ─────────────────────────────────────────────────────────────

export class ChatSession {
  private ai: GoogleGenAI;
  private history: Turn[] = [];
  private ws: WebSocket;
  private abortController: AbortController | null = null;
  constructor(ws: WebSocket, apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.ws = ws;
  }

  async handleMessage(text: string, path?: string): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.history.push({ role: 'user', parts: [{ text }] });
    await this.stream(path);
  }

  private buildSystemInstruction(path?: string): string {
    const employees = listEmployees();
    const employeeData =
      employees.length === 0
        ? 'No employees have been onboarded yet.'
        : employees
            .map((e) => `- ${e.name} | ${e.role} | ${e.team} | Start: ${e.start_date}`)
            .join('\n');
    const pageNames: Record<string, string> = {
      '/': 'Home — document scanner (ready to scan)',
      '/employees': 'Employee list',
      '/contract': 'Contract generator',
      'home-scanner': 'Home — document scanner (ready to scan a new document)',
      'home-onboarding': 'Home — onboarding in progress (agent dialog active, do not navigate away)',
      'home-employee-preview': 'Home — employee preview card (user is reviewing extracted employee data and has not yet confirmed)',
      'home-employee-saved': 'Home — employee saved confirmation (onboarding complete, employee card shown)',
      'home-error': 'Home — error state',
    };
    const pageName = path ? (pageNames[path] ?? path) : 'unknown';
    return SYSTEM_INSTRUCTION.replace('{EMPLOYEE_DATA}', employeeData)
      + `\n\n## Current page\nThe user is currently on: ${pageName}`;
  }

  private async stream(path?: string): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    let fullText = '';
    let sentLength = 0;

    try {
      const response = await this.ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: this.history,
        config: { systemInstruction: this.buildSystemInstruction(path) },
      });

      for await (const chunk of response) {
        if (signal.aborted) break;
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text) {
          fullText += text;
          // Strip complete NAV tags; hold back any partial NAV tag at the end
          // This prevents split-chunk artifacts where [NAV: arrives before the closing ]
          const display = fullText
            .replace(/\[NAV:\/[^\]]*\]/g, '')  // remove complete tags
            .replace(/\[NAV[^\]]*$/, '');        // hold back partial tag at end
          const newChars = display.slice(sentLength);
          if (newChars) {
            this.send({ type: 'chunk', text: newChars });
            sentLength = display.length;
          }
        }
      }

      if (!signal.aborted) {
        this.history.push({ role: 'model', parts: [{ text: fullText }] });
        this.send({ type: 'turn_complete' });

        // Send navigation action if present
        const navMatch = fullText.match(/\[NAV:(\/[^\]]*)\]/);
        if (navMatch) {
          this.send({ type: 'action', action: 'navigate', path: navMatch[1] });
        }
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.send({ type: 'error', text: msg });
    } finally {
      this.abortController = null;
    }
  }

  private send(event: ChatWsEvent): void {
    if (this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(event));
    }
  }

  close(): void {
    this.abortController?.abort();
  }
}
