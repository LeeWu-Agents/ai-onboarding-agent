'use client';

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentMode = 'idle' | 'onboarding';

interface AgentContextValue {
  mode: AgentMode;
  onboardingMessage: string;
  autoStartOnboarding: boolean;
  uiContext: string;

  // page.tsx → context (onboarding lifecycle)
  enterOnboarding: (replyFn: (text: string) => void, cancelFn: () => void) => void;
  setOnboardingMessage: (msg: string) => void;
  exitOnboarding: () => void;
  clearAutoStart: () => void;
  setUiContext: (ctx: string) => void;

  // AgentPanel → context (user reply forwarded to onboarding session)
  sendOnboardingReply: (text: string) => void;
  cancelOnboarding: () => void;
  triggerAutoStart: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AgentProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AgentMode>('idle');
  const [onboardingMessage, setOnboardingMessageState] = useState('');
  const [autoStartOnboarding, setAutoStartOnboarding] = useState(false);
  const [uiContext, setUiContextState] = useState('home-scanner');

  const onboardingReplyRef = useRef<((text: string) => void) | null>(null);
  const onboardingCancelRef = useRef<(() => void) | null>(null);

  const enterOnboarding = useCallback((replyFn: (text: string) => void, cancelFn: () => void) => {
    onboardingReplyRef.current = replyFn;
    onboardingCancelRef.current = cancelFn;
    setOnboardingMessageState('');
    setMode('onboarding');
  }, []);

  const setOnboardingMessage = useCallback((msg: string) => {
    setOnboardingMessageState(msg);
  }, []);

  const exitOnboarding = useCallback(() => {
    onboardingReplyRef.current = null;
    onboardingCancelRef.current = null;
    setMode('idle');
  }, []);

  const sendOnboardingReply = useCallback((text: string) => {
    onboardingReplyRef.current?.(text);
  }, []);

  const cancelOnboarding = useCallback(() => {
    onboardingCancelRef.current?.();
  }, []);

  const setUiContext = useCallback((ctx: string) => setUiContextState(ctx), []);
  const triggerAutoStart = useCallback(() => setAutoStartOnboarding(true), []);
  const clearAutoStart = useCallback(() => setAutoStartOnboarding(false), []);

  return (
    <AgentContext.Provider
      value={{
        mode,
        onboardingMessage,
        autoStartOnboarding,
        uiContext,
        enterOnboarding,
        setOnboardingMessage,
        exitOnboarding,
        clearAutoStart,
        setUiContext,
        sendOnboardingReply,
        cancelOnboarding,
        triggerAutoStart,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}
