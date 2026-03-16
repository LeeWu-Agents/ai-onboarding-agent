'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CameraCapture from '@/components/CameraCapture';
import EmployeeView from '@/components/EmployeeView';
import { OnboardingSession, EmployeeData, AgentMessage } from '@/lib/liveSession';
import { createSession, saveEmployee } from '@/lib/api';
import { useAgent } from '@/lib/agentContext';

type AppState = 'idle' | 'processing' | 'dialog' | 'preview' | 'saved' | 'error';

function normalizeName(raw: string): string {
  return raw.trim().replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [employee, setEmployee] = useState<(EmployeeData & { employee_id?: string }) | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sessionRef = useRef<OnboardingSession | null>(null);
  const sessionIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { enterOnboarding, setOnboardingMessage, exitOnboarding, autoStartOnboarding, clearAutoStart, setUiContext } = useAgent();

  // Auto-open file picker when agent navigates here with autostart flag
  useEffect(() => {
    if (autoStartOnboarding && appState === 'idle') {
      clearAutoStart();
      // Small delay to ensure the page is rendered before triggering the picker
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  }, [autoStartOnboarding, appState, clearAutoStart]);

  const handleCapture = useCallback(async (base64: string, mimeType: string) => {
    setAppState('processing');
    enterOnboarding(
      (text: string) => sessionRef.current?.sendText(text),
      () => {
        sessionRef.current?.close();
        sessionRef.current = null;
        sessionIdRef.current = '';
        setAppState('idle');
        setEmployee(null);
      },
    );

    try {
      const { session_id } = await createSession();
      sessionIdRef.current = session_id;

      const liveSession = new OnboardingSession(async (msg: AgentMessage) => {
        if (msg.type === 'chunk') {
          setOnboardingMessage(msg.text ?? '');
          setAppState('dialog');
        } else if (msg.type === 'status') {
          setAppState('processing');
          setOnboardingMessage('');
        } else if (msg.type === 'complete' && msg.employee) {
          setEmployee({ ...msg.employee, name: normalizeName(msg.employee.name ?? '') });
          setAppState('preview');
          sessionRef.current?.close();
          exitOnboarding(); // minimizes panel — focus shifts to employee preview card
        } else if (msg.type === 'error') {
          setErrorMsg(msg.text ?? 'Something went wrong.');
          setAppState('error');
          exitOnboarding();
        }
      });

      sessionRef.current = liveSession;
      await liveSession.start(base64, mimeType);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setAppState('error');
      exitOnboarding();
    }
  }, [enterOnboarding, setOnboardingMessage, exitOnboarding]);

  const handleConfirm = useCallback(async (editedData: EmployeeData) => {
    try {
      const saved = await saveEmployee({ session_id: sessionIdRef.current, ...editedData });
      setEmployee({ ...editedData, employee_id: saved.employee_id });
      setAppState('saved');
      exitOnboarding();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save.');
      setAppState('error');
    }
  }, [exitOnboarding]);

  const handleDiscard = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    sessionIdRef.current = '';
    setAppState('idle');
    setEmployee(null);
    exitOnboarding();
  }, [exitOnboarding]);

  const handleReset = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    sessionIdRef.current = '';
    setAppState('idle');
    setEmployee(null);
    setErrorMsg('');
    exitOnboarding();
  }, [exitOnboarding]);

  // Scroll to top on state transitions — fixes mobile viewport drift after soft keyboard dismisses
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [appState]);

  // Keep agent informed of current UI state so chat context is accurate
  useEffect(() => {
    const map: Record<AppState, string> = {
      idle:       'home-scanner',
      processing: 'home-scanner',
      dialog:     'home-onboarding',
      preview:    'home-employee-preview',
      saved:      'home-employee-saved',
      error:      'home-error',
    };
    setUiContext(map[appState]);
  }, [appState, setUiContext]);

  // ESC: abort active session or discard preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (appState === 'dialog' || appState === 'processing' || appState === 'preview') {
        handleDiscard();
      } else if (appState === 'error') {
        handleReset();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [appState, handleDiscard, handleReset]);

  return (
    <main className="bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AI Onboarding Agent</h1>
        <p className="text-gray-500 mt-3 text-sm max-w-sm mx-auto leading-relaxed">
          Scan or upload an identity document to create a structured employee profile — powered by Gemini AI.
        </p>
      </div>

      {(appState === 'idle' || appState === 'processing') && (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <CameraCapture onCapture={handleCapture} disabled={appState === 'processing'} fileInputRef={fileInputRef} />
          {appState === 'processing' && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Analyzing document…
            </div>
          )}
        </div>
      )}

      {(appState === 'preview' || appState === 'saved') && employee && (
        <EmployeeView
          employee={employee}
          mode={appState === 'saved' ? 'saved' : 'preview'}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
          onReset={handleReset}
        />
      )}

      {appState === 'error' && (
        <div className="text-center space-y-3">
          <p className="text-red-600 text-sm">{errorMsg}</p>
          <button onClick={handleReset} className="text-blue-600 text-sm underline hover:text-blue-700">
            Try again
          </button>
        </div>
      )}
    </main>
  );
}
