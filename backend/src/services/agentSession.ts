import { GoogleGenAI } from '@google/genai';
import type { WebSocket } from 'ws';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WsMessage {
  type: 'start' | 'message';
  imageBase64?: string;
  mimeType?: string;
  text?: string;
}

export interface WsEvent {
  type: 'chunk' | 'turn_complete' | 'complete' | 'error' | 'status';
  text?: string;
  employee?: EmployeeData;
}

export interface EmployeeData {
  name: string;
  birth_date: string;
  role: string;
  team: string;
  start_date: string;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type Turn = { role: 'user' | 'model'; parts: Part[] };

// ─── Organisation Config (Grounding) ─────────────────────────────────────────

const ORG_CONFIG = {
  teams: ['Therapy', 'Reception', 'Management'],
  roles: ['Therapist', 'Receptionist', 'Manager', 'Other'],
};

// ─── System Instruction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are an AI onboarding agent for a wellness studio.
Your job: extract structured employee data from documents and complete missing fields through concise dialogue.

## Organisation Context (use ONLY these values)
Available teams: ${ORG_CONFIG.teams.join(', ')}
Available roles: ${ORG_CONFIG.roles.join(', ')}

## Document Analysis
When you receive an image:
1. First check: Is this a valid identity document (ID card, passport, or employee form)?
   - If NOT valid: respond ONLY with: "I could not identify a valid ID document. Please take another photo."
   - If valid: continue below.
2. Extract: name, date_of_birth from the document.
3. Confidence rule: if confidence < 0.7 for any field, ask: "I noticed [field] as [value] — is that correct?"
4. Birth date rule (CRITICAL — NEVER SKIP):
   - NEVER use "UNKNOWN", "N/A", "null", or any placeholder for date_of_birth in the completion JSON.
   - If date_of_birth is NOT found on the document: respond ONLY with "No date of birth found. Please enter it manually." — then WAIT for the user's answer before continuing.
   - If date_of_birth is found but unclear: respond ONLY with "I'm not sure about the date of birth. Is [value] correct, or would you like to enter it manually?" — then WAIT for confirmation.
   - You MUST have a real, confirmed date_of_birth value before you may output the completion JSON.
   - Only proceed once you have a confirmed date_of_birth from the user or document.
5. Announce what you detected: "I detected: [name], born [date_of_birth]."
6. Ask: "Should I create an employee profile?"

## Date Format (CRITICAL — applies to ALL dates)
All dates (birth_date AND start_date) MUST be in DD.MM.YYYY format in the completion JSON.
- Accept any format the user types (e.g. 01/15/1990 · 1990-01-15 · 15. Jan 1990 · 15/01/1990).
- Always convert to DD.MM.YYYY before outputting the JSON.
- Example: "January 15, 1990" → "15.01.1990" | "2025-03-01" → "01.03.2025"
- When asking for a date, always specify: "Please use DD.MM.YYYY format."

## Missing Fields (after user confirms)
Ask for missing fields ONE at a time in this order:
1. role → "Which role should I assign? Available: ${ORG_CONFIG.roles.join(', ')}."
2. team → "Which team should [name] join? Available: ${ORG_CONFIG.teams.join(', ')}."
3. start_date → "What is the start date? Please use DD.MM.YYYY format."

## Interruption Handling
If the user provides information mid-flow (e.g. "Assign her to Therapy"), immediately incorporate it and confirm: "Got it — assigning to Therapy. [continue with next missing field]."

## Completion
When all 5 fields are collected (name, birth_date, role, team, start_date):
1. Say: "Employee profile ready."
2. On the NEXT line, output ONLY this JSON (nothing else after it):
{"status":"complete","employee":{"name":"...","birth_date":"...","role":"...","team":"...","start_date":"..."}}

## Rules
- Maximum 2 sentences per message (except the final JSON).
- Never invent roles or teams outside the available lists.
- Never guess — ask when uncertain.
- Do not use markdown formatting in responses.`;

// ─── Name Normalisation ───────────────────────────────────────────────────────
// Capitalizes first letter of each word, lowercases the rest.
function normalizeName(raw: string): string {
  return raw.trim().replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ─── Date Normalisation ───────────────────────────────────────────────────────
// Converts common date formats to DD.MM.YYYY. Returns input unchanged if unrecognised.
function normalizeDateDDMMYYYY(raw: string): string {
  const s = raw.trim();
  // Already DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  // DD/MM/YYYY or DD-MM-YYYY
  const eu = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (eu) return `${eu[1]}.${eu[2]}.${eu[3]}`;
  return s; // unrecognised — return as-is, agent should have handled it
}

// ─── Agent Session ────────────────────────────────────────────────────────────

export class AgentSession {
  private ai: GoogleGenAI;
  private history: Turn[] = [];
  private ws: WebSocket;
  private abortController: AbortController | null = null;

  constructor(ws: WebSocket, apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.ws = ws;
  }

  async handleMessage(msg: WsMessage): Promise<void> {
    // Interrupt laufenden Stream wenn neue Nachricht kommt
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const userParts: Part[] = [];

    if (msg.type === 'start' && msg.imageBase64 && msg.mimeType) {
      userParts.push({ inlineData: { mimeType: msg.mimeType, data: msg.imageBase64 } });
      userParts.push({ text: 'Please analyze this document.' });
    } else if (msg.type === 'message' && msg.text) {
      userParts.push({ text: msg.text });
    } else {
      return;
    }

    this.history.push({ role: 'user', parts: userParts });

    await this.stream();
  }

  private async stream(): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    let fullText = '';

    try {
      const response = await this.ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: this.history,
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });

      for await (const chunk of response) {
        if (signal.aborted) break;
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text) {
          fullText += text;
          this.send({ type: 'chunk', text });
        }
      }

      if (!signal.aborted) {
        this.history.push({ role: 'model', parts: [{ text: fullText }] });
        this.send({ type: 'turn_complete' });

        // Complete-JSON erkennen
        const jsonMatch = fullText.match(/\{"status":"complete"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const result = JSON.parse(jsonMatch[0]);
            if (result.status === 'complete' && result.employee) {
              // Namen normalisieren → Title Case
              result.employee.name = normalizeName(result.employee.name ?? '');
              // Datumsformat normalisieren → DD.MM.YYYY
              result.employee.birth_date = normalizeDateDDMMYYYY(result.employee.birth_date ?? '');
              result.employee.start_date = normalizeDateDDMMYYYY(result.employee.start_date ?? '');
              // Validierung: birth_date darf nicht fehlen oder Platzhalter sein
              const dob: string = result.employee.birth_date ?? '';
              const dobInvalid = ['unknown', 'n/a', 'null', ''].includes(dob.toLowerCase().trim());
              if (dobInvalid) {
                // Backend-Fallback: Agent nochmals nach Geburtsdatum fragen
                this.history.push({
                  role: 'user',
                  parts: [{ text: 'The date of birth is still missing. Please ask the user to provide their date of birth before completing the profile.' }],
                });
                await this.stream();
                return;
              }
              this.send({ type: 'complete', employee: result.employee });
            }
          } catch {
            // kein gültiges JSON — ignorieren
          }
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

  private send(event: WsEvent): void {
    if (this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(event));
    }
  }

  close(): void {
    this.abortController?.abort();
  }
}
