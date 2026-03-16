'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAgent } from '@/lib/agentContext';

// ─── Click flash ─────────────────────────────────────────────────────────────

function flashClick(e: React.MouseEvent) {
  const el = e.currentTarget as HTMLElement;
  el.classList.remove('click-flash');
  void el.offsetWidth; // restart animation if clicked again
  el.classList.add('click-flash');
}

// ─── Quick replies (onboarding mode only) ────────────────────────────────────

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
    const triggers = ['correct', 'should i', 'create', 'confirm', 'is that', 'would you like', 'manually', 'profile'];
    if (triggers.some((t) => lower.includes(t))) return QUICK_REPLIES.yesno;
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentPanel() {
  const { mode, onboardingMessage, uiContext, sendOnboardingReply, cancelOnboarding, triggerAutoStart } = useAgent();
  const router = useRouter();
  const pathname = usePathname();

  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [listening, setListening] = useState(false);

  // Idle chat state (managed locally — no shared state needed)
  const [idleMessage, setIdleMessage] = useState('');
  const [idleLoading, setIdleLoading] = useState(false);

  // Proactive contract offer state
  const [proactiveEmployee, setProactiveEmployee] = useState<{ name: string; birth_date: string; role: string; team: string; start_date: string } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const chatWsRef = useRef<WebSocket | null>(null);
  // Always-current ref to submit — avoids stale closures inside recognition.onresult
  const submitRef = useRef<(text: string) => void>(() => {});

  const isOnboarding = mode === 'onboarding';
  const message = isOnboarding ? onboardingMessage : idleMessage;

  // ── Auto-expand when onboarding starts; auto-minimize when it ends ──────────
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (mode === 'onboarding') {
      setExpanded(true);
    } else if (prevModeRef.current === 'onboarding' && mode === 'idle') {
      // Onboarding just finished — reset chat session so next interaction starts fresh
      if (chatWsRef.current) {
        chatWsRef.current.close();
        chatWsRef.current = null;
      }
      setIdleMessage('');
      const timer = setTimeout(() => setExpanded(false), 1500);
      prevModeRef.current = mode;
      return () => clearTimeout(timer);
    }
    prevModeRef.current = mode;
  }, [mode]);

  // ── ESC: minimize + stop voice ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
        stopVoice();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Mic: stop on tab hidden or page unload ───────────────────────────────────
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) stopVoice(); };
    const onUnload = () => stopVoice();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  // ── Mic: stop when panel minimizes ───────────────────────────────────────────
  useEffect(() => {
    if (!expanded) stopVoice();
  }, [expanded]);

  // ── Proactive contract offer ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { employee } = (e as CustomEvent).detail;
      setTimeout(() => {
        setProactiveEmployee(employee);
        setIdleMessage(`${employee.name} has no employment contract on file yet. Shall I prepare one?`);
        setExpanded(true);
      }, 2000);
    };
    window.addEventListener('agentProactiveEmployee', handler);
    return () => window.removeEventListener('agentProactiveEmployee', handler);
  }, []);

  const handleProactiveReply = (reply: string) => {
    if (reply === 'Yes, please' && proactiveEmployee) {
      const params = new URLSearchParams({
        name: proactiveEmployee.name,
        birth_date: proactiveEmployee.birth_date,
        role: proactiveEmployee.role,
        team: proactiveEmployee.team,
        start_date: proactiveEmployee.start_date,
      });
      router.push(`/contract?${params.toString()}`);
    }
    setProactiveEmployee(null);
    setIdleMessage('');
    if (reply === 'Not now') setExpanded(false);
  };

  // ── iOS keyboard: keep panel above virtual keyboard via visualViewport ────────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kbHeight = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      document.documentElement.style.setProperty('--keyboard-height', `${kbHeight}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    };
  }, []);

  // ── Idle chat WebSocket ──────────────────────────────────────────────────────
  const getChatWs = useCallback((): WebSocket => {
    const existing = chatWsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing;
    }
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
      .replace(/^http/, 'ws') + '/ws/chat';
    const ws = new WebSocket(wsUrl);
    let buffer = '';

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chunk') {
        buffer += data.text ?? '';
        setIdleMessage(buffer);
        setIdleLoading(false);
      } else if (data.type === 'turn_complete') {
        buffer = '';
      } else if (data.type === 'action' && data.action === 'navigate' && data.path) {
        if (data.path === '/' || data.path === '/?autostart=1') {
          triggerAutoStart();
          router.push('/');
        } else {
          router.push(data.path);
        }
      } else if (data.type === 'error') {
        setIdleMessage('Something went wrong. Please try again.');
        setIdleLoading(false);
      }
    };
    ws.onerror = () => {
      setIdleMessage('Connection error. Please try again.');
      setIdleLoading(false);
    };
    chatWsRef.current = ws;
    return ws;
  }, [router]);

  // ── Voice helpers ────────────────────────────────────────────────────────────
  const stopVoice = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const toggleVoice = () => {
    if (listening) { stopVoice(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    if (!SR) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      recognition.stop();
      submitRef.current(text);
    };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognition.onerror = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const submit = (text: string) => {
    if (!text.trim()) return;
    setInputValue('');

    if (isOnboarding) {
      sendOnboardingReply(text.trim());
    } else {
      setIdleMessage('');
      setIdleLoading(true);
      const ws = getChatWs();
      const payload = JSON.stringify({ type: 'message', text: text.trim(), path: uiContext || pathname });
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        ws.addEventListener('open', () => ws.send(payload), { once: true });
      }
    }
  };

  // Keep submitRef in sync on every render so recognition.onresult always calls the latest version
  submitRef.current = submit;

  const quickReplies = proactiveEmployee
    ? ['Yes, please', 'Not now']
    : (isOnboarding && message ? detectQuickReplies(message) : null);

  // ── Minimized bubble ─────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        className="fixed right-6 z-50 cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
        style={{ bottom: 'calc(4rem + var(--keyboard-height, 0px))' }}
        onClick={() => setExpanded(true)}
        title="AI Agent"
      >
        <div
          className="relative w-14 h-14 rounded-full shadow-2xl flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)' }}
        >
          <span className="text-white font-bold text-xs tracking-widest select-none leading-none">AI</span>
          <span className="text-blue-200 text-[9px] tracking-wider select-none leading-none mt-0.5">AGENT</span>
          {isOnboarding && (
            <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>
      </div>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────────────
  return (
    <div
      className="fixed right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: 'calc(4rem + var(--keyboard-height, 0px))' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnboarding ? 'bg-green-400 animate-pulse' : 'bg-blue-300'}`} />
          <span className="text-white text-sm font-semibold tracking-wide">AI Onboarding Agent</span>
        </div>
        <div className="flex items-center gap-2">
          {isOnboarding && (
            <button
              onClick={(e) => { flashClick(e); cancelOnboarding(); }}
              title="Cancel onboarding"
              className="text-blue-200 hover:text-red-300 text-xs font-medium transition px-2 py-1 rounded hover:bg-white/10"
            >
              ✕ Cancel
            </button>
          )}
          <button
            onClick={() => setExpanded(false)}
            title="Minimize (Esc)"
            className="text-blue-200 hover:text-white text-xl leading-none transition"
          >
            ─
          </button>
        </div>
      </div>

      {/* Message area */}
      {message ? (
        <div className="px-4 pt-4 pb-2">
          <p className="text-gray-800 text-sm leading-relaxed">{message}</p>
        </div>
      ) : idleLoading ? (
        <div className="px-4 pt-4 pb-2 flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Thinking…
        </div>
      ) : (
        <div className="px-4 pt-4 pb-2">
          <p className="text-gray-400 text-sm italic">
            {isOnboarding
              ? 'Analyzing document…'
              : "Ask me anything — e.g. 'Show all employees' or 'Start a new onboarding'."}
          </p>
        </div>
      )}

      {/* Quick replies (onboarding only) */}
      {quickReplies && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={(e) => { flashClick(e); proactiveEmployee ? handleProactiveReply(reply) : submit(reply); }}
              className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit(inputValue)}
            placeholder={listening ? 'Listening…' : isOnboarding ? 'Type or speak…' : 'Ask me anything…'}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={(e) => { flashClick(e); toggleVoice(); }}
            title={listening ? 'Stop recording' : 'Voice input'}
            className={`px-3 py-2 rounded-lg text-base transition ${
              listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🎤
          </button>
          <button
            onClick={(e) => { flashClick(e); submit(inputValue); }}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
