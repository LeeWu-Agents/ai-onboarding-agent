'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  message: string;
  onReply: (reply: string) => void;
  visible: boolean; // true = active session
}

const QUICK_REPLIES: Record<string, string[]> = {
  role: ['Therapist', 'Receptionist', 'Manager', 'Other'],
  team: ['Therapy', 'Reception', 'Management'],
  yesno: ['Yes', 'No'],
};

function detectQuickReplies(message: string): string[] | null {
  const lower = message.toLowerCase();
  if (lower.includes('role')) return QUICK_REPLIES.role;
  if (lower.includes('team')) return QUICK_REPLIES.team;
  if (lower.includes('?')) {
    const yesNoTriggers = ['correct', 'should i', 'create', 'confirm', 'is that', 'would you like', 'manually', 'profile'];
    if (yesNoTriggers.some((t) => lower.includes(t))) return QUICK_REPLIES.yesno;
  }
  return null;
}

export default function AgentPanel({ message, onReply, visible }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Auto-expand when session becomes active
  useEffect(() => {
    if (visible) setExpanded(true);
  }, [visible]);

  // ESC minimizes panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const quickReplies = message ? detectQuickReplies(message) : null;

  const submit = (text: string) => {
    if (!text.trim() || !visible) return;
    onReply(text.trim());
    setInputValue('');
  };

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    if (!SR) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      submit(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // ── Minimized bubble ────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        className="fixed bottom-16 right-6 z-50 cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
        onClick={() => setExpanded(true)}
        title="AI Onboarding Agent"
      >
        <div className="relative w-14 h-14 rounded-full shadow-2xl flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)' }}>
          <span className="text-white font-bold text-xs tracking-widest select-none leading-none">AI</span>
          <span className="text-blue-200 text-[9px] tracking-wider select-none leading-none mt-0.5">AGENT</span>
          {visible && (
            <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>
      </div>
    );
  }

  // ── Expanded panel ──────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-16 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)' }}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${visible ? 'bg-green-400 animate-pulse' : 'bg-blue-300'}`} />
          <span className="text-white text-sm font-semibold tracking-wide">AI Onboarding Agent</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          title="Minimize (Esc)"
          className="text-blue-200 hover:text-white text-xl leading-none transition"
        >
          ─
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-gray-800 text-sm leading-relaxed">{message}</p>
        </div>
      )}

      {/* No active session hint */}
      {!visible && !message && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-gray-400 text-sm italic">Scan a document to start the onboarding.</p>
        </div>
      )}

      {/* Quick-Reply-Buttons */}
      {visible && quickReplies && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => submit(reply)}
              className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Text- und Voice-Eingabe */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit(inputValue)}
            placeholder={!visible ? 'No active session…' : listening ? 'Listening…' : 'Type or speak…'}
            disabled={!visible}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={toggleVoice}
            disabled={!visible}
            title={listening ? 'Stop recording' : 'Voice input'}
            className={`px-3 py-2 rounded-lg text-base transition ${
              listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40'
            }`}
          >
            🎤
          </button>
          <button
            onClick={() => submit(inputValue)}
            disabled={!visible}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
