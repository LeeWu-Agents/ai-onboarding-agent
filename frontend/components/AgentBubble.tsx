'use client';

import { useRouter } from 'next/navigation';

export default function AgentBubble() {
  const router = useRouter();
  return (
    <div
      className="fixed bottom-16 right-6 cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
      onClick={() => router.push('/')}
      title="Back to Onboarding"
    >
      <div className="w-14 h-14 rounded-full shadow-2xl flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)' }}>
        <span className="text-white font-bold text-xs tracking-widest select-none leading-none">AI</span>
        <span className="text-blue-200 text-[9px] tracking-wider select-none leading-none mt-0.5">AGENT</span>
      </div>
    </div>
  );
}
