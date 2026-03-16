'use client';

import { useEffect } from 'react';
import { AgentProvider } from '@/lib/agentContext';
import AgentPanel from '@/components/AgentPanel';

function BackendWarmup() {
  useEffect(() => {
    const url = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/health';
    fetch(url).catch(() => {});
  }, []);
  return null;
}

export default function AgentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AgentProvider>
      <BackendWarmup />
      {children}
      <AgentPanel />
    </AgentProvider>
  );
}
