import { useEffect, useRef, useCallback } from 'react';
import { MouseClickLog, KeyStrokeLog, InteractionSession } from '@/app/types';
import { dbService, arrayUnion } from '@/lib/services';

interface UseDataCollectionProps {
  eventId: string;
  enabled?: boolean;
}

export function useDataCollection({ eventId, enabled = true }: UseDataCollectionProps) {
  const sessionRef = useRef<InteractionSession | null>(null);

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const initializeSession = useCallback(() => {
    if (!enabled) return;

    sessionRef.current = {
      sessionId: generateSessionId(),
      eventId,
      startTime: Date.now(),
      mouseClicks: [],
      keyStrokes: []
    };
  }, [eventId, enabled]);

  const logMouseClick = useCallback(() => {
    if (!enabled || !sessionRef.current) return;

    const clickLog: MouseClickLog = {
      timestamp: Date.now(),
    };

    sessionRef.current.mouseClicks.push(clickLog);
  }, [enabled]);

  const logKeyStroke = useCallback(() => {
    if (!enabled || !sessionRef.current) return;

    const keyLog: KeyStrokeLog = {
      timestamp: Date.now(),
    };

    sessionRef.current.keyStrokes.push(keyLog);
  }, [enabled]);

  const saveSession = useCallback(async () => {
    if (!sessionRef.current || !enabled) return;

    try {
      sessionRef.current.endTime = Date.now();
      
      await dbService.updateDocument('events', eventId, {
        interactionSessions: arrayUnion(sessionRef.current),
      });
      
    } catch (error) {
      console.error('Error saving interaction session:', error);
    }
  }, [eventId, enabled]);

  const exportData = useCallback(() => {
    if (!sessionRef.current) return null;
    
    return {
      ...sessionRef.current,
      exportedAt: Date.now()
    };
  }, []);

  const getSessionStats = useCallback(() => {
    return {
      mouseClicks: sessionRef.current?.mouseClicks.length || 0,
      keyStrokes: sessionRef.current?.keyStrokes.length || 0,
      sessionDuration: sessionRef.current ? Date.now() - sessionRef.current.startTime : 0
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    initializeSession();

    // Simple event listeners - just capture the fact that they happened
    const handleClick = () => logMouseClick();
    const handleKeyDown = () => logKeyStroke();

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    // Save session periodically (every 30 seconds)
    const saveInterval = setInterval(saveSession, 30000);

    // Save on page unload
    const handleBeforeUnload = () => {
      saveSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      clearInterval(saveInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Final save
      saveSession();
    };
  }, [enabled, initializeSession, logMouseClick, logKeyStroke, saveSession]);

  return {
    exportData,
    getSessionStats,
    saveSession
  };
}