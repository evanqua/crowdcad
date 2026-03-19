'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@heroui/react';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { ArrowRight } from 'lucide-react';

/**
 * Lite Landing Page (/lite)
 *
 * This page is the entry point for Lite mode.
 * - No login required
 * - No Firebase auth or firestore calls
 * - User can enter a local event name to start Lite setup
 * - Entirely local-only
 *
 * GUARDRAIL: This file intentionally does NOT import firebase.ts, useAuth(), or any cloud hooks.
 * If you need to add data persistence, use IndexedDB or localStorage.
 */

export default function LiteLandingPage() {
  const router = useRouter();
  const [eventName, setEventName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const inputClassNames = {
    inputWrapper:
      'rounded-2xl px-4 bg-surface-lighter/30 border border-surface-light/30 hover:bg-surface-lighter/30 shadow-none group-data-[focus=true]:bg-surface-lighter/30 group-data-[focus-visible=true]:bg-surface-lighter/30 group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 focus-within:ring-0',
    input:
      'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0',
  } as const;

  const handleStartLiteMode = () => {
    if (!eventName.trim()) {
      alert('Please enter an event name');
      return;
    }

    // Generate a simple local event ID (could be UUID in prod, but for now use timestamp-based)
    const localEventId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store event name in sessionStorage for retrieval on create page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`lite_event_${localEventId}`, JSON.stringify({ name: eventName }));
    }

    setIsCreating(true);
    // Navigate to Lite create page
    router.push(`/lite/create?eventId=${localEventId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartLiteMode();
    }
  };

  return (
    <main className="h-[100dvh] w-full max-w-full overflow-hidden relative flex flex-col text-surface-light bg-surface-deepest">
      {/* Aurora background */}
      <AuroraBackground className="absolute inset-0 h-full w-full" showRadialGradient={true} />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 20%, rgba(13,13,14,0.85) 100%)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 gap-12 py-12">
        {/* Header and tagline */}
        <div className="flex flex-col items-center gap-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white text-center leading-tight">
              CrowdCAD Lite
            </h1>
          </div>
          <p className="text-lg sm:text-xl text-gray-300 text-center">
            Fast, lightweight dispatch for events — no internet, no cloud, no account required
          </p>
        </div>

        {/* Event setup form */}
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="event-name" className="text-sm font-semibold text-gray-200">
              Event Name
            </label>
            <Input
              id="event-name"
              placeholder="e.g., Big Game"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              onKeyDown={handleKeyDown}
              classNames={inputClassNames}
              size="lg"
              disabled={isCreating}
            />
          </div>

          <Button
            onClick={handleStartLiteMode}
            isLoading={isCreating}
            color="primary"
            size="lg"
            className="w-full flex items-center justify-center gap-2"
          >
            Start Lite Mode
            <ArrowRight className="w-4 h-4" />
          </Button>

          <p className="text-xs text-gray-400 text-center">
            You can also switch to the{' '}
            <Link href="/" className="text-blue-400 hover:text-blue-300 underline">
              cloud version
            </Link>
            {' '}if you&apos;d like full features
          </p>
        </div>
      </div>
    </main>
  );
}
