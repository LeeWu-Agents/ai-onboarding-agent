'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CameraCapture from '@/components/CameraCapture';
import AgentPanel from '@/components/AgentPanel';
import EmployeeView from '@/components/EmployeeView';
import { OnboardingSession, EmployeeData, AgentMessage } from '@/lib/liveSession';
import { createSession, saveEmployee } from '@/lib/api';

type AppState = 'idle' | 'processing' | 'dialog' | 'preview' | 'saved' | 'error';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [agentMessage, setAgentMessage] = useState('');
  const [employee, setEmployee] = useState<(EmployeeData & { employee_id?: string }) | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sessionRef = useRef<OnboardingSession | null>(null);
  const sessionIdRef = useRef<string>('');
  const router = useRouter();

  const handleCapture = useCallback(async (base64: string, mimeType: string) => {
    setAppState('processing');
    setAgentMessage('');

    try {
      const { session_id } = await createSession();
      sessionIdRef.current = session_id;

      const liveSession = new OnboardingSession(async (msg: AgentMessage) => {
        if (msg.type === 'chunk') {
          setAgentMessage(msg.text ?? '');
          setAppState('dialog');
        } else if (msg.type === 'status') {
          // Interrupt: zurück zu "processing" während Agent antwortet
          setAppState('processing');
          setAgentMessage('');
        } else if (msg.type === 'complete' && msg.employee) {
          setEmployee(msg.employee);
          setAppState('preview');
          sessionRef.current?.close();
        } else if (msg.type === 'error') {
          setErrorMsg(msg.text ?? 'Something went wrong.');
          setAppState('error');
        }
      });

      sessionRef.current = liveSession;
      await liveSession.start(base64, mimeType);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setAppState('error');
    }
  }, []);

  const handleConfirm = useCallback(async (editedData: EmployeeData) => {
    try {
      const saved = await saveEmployee({ session_id: sessionIdRef.current, ...editedData });
      setEmployee({ ...editedData, employee_id: saved.employee_id });
      setAppState('saved');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save.');
      setAppState('error');
    }
  }, []);

  const handleDiscard = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    sessionIdRef.current = '';
    setAppState('idle');
    setEmployee(null);
  }, []);

  const handleReply = useCallback((reply: string) => {
    sessionRef.current?.sendText(reply);
  }, []);

  const handleReset = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    sessionIdRef.current = '';
    setAppState('idle');
    setAgentMessage('');
    setEmployee(null);
    setErrorMsg('');
  }, []);

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
          <CameraCapture onCapture={handleCapture} disabled={appState === 'processing'} />
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


      {/* Panel sichtbar sobald Session läuft (dialog + processing für Unterbrechungen) */}
      <AgentPanel
        message={agentMessage}
        onReply={handleReply}
        visible={(appState === 'dialog' || appState === 'processing') && !!sessionRef.current}
      />
    </main>
  );
}
