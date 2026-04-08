import { useEffect, useRef, useState } from 'react';
import type { Call, Event } from '@/app/types';

type EditableCallField = keyof Call | 'ageSex';

type PendingValues = Record<string, Partial<Record<EditableCallField, string>>>;

interface LogEntry {
  timestamp: number;
  message: string;
}

type FormatAgeSex = (age?: string | number, gender?: string) => string;

export function useCallTrackingState(event: Event | undefined, formatAgeSex: FormatAgeSex) {
  const [notesTexts, setNotesTexts] = useState<Record<string, string>>({});
  const notesFocusedRef = useRef<string | null>(null);
  const [logTexts, setLogTexts] = useState<Record<string, string>>({});
  const logFocusedRef = useRef<string | null>(null);
  const [pendingValues, setPendingValues] = useState<PendingValues>({});

  useEffect(() => {
    if (!event?.calls) return;
    setNotesTexts((prev) => {
      const next = { ...prev };
      for (const call of event.calls) {
        if (notesFocusedRef.current !== call.id) {
          next[call.id] = call.notes || '';
        }
      }
      return next;
    });
  }, [event?.calls]);

  useEffect(() => {
    if (!event?.calls) return;
    setLogTexts((prev) => {
      const next = { ...prev };
      for (const call of event.calls) {
        if (logFocusedRef.current !== call.id) {
          const text = call.log && call.log.length > 0
            ? call.log.map((entry: LogEntry) => entry.message).join('\n')
            : '';
          next[call.id] = text;
        }
      }
      return next;
    });
  }, [event?.calls]);

  useEffect(() => {
    if (!event?.calls || Object.keys(pendingValues).length === 0) return;
    const newPending = { ...pendingValues } as typeof pendingValues;
    let changed = false;

    for (const callId of Object.keys(pendingValues)) {
      const callNow = event.calls.find((call) => call.id === callId);
      if (!callNow) {
        delete newPending[callId];
        changed = true;
        continue;
      }

      const pv = pendingValues[callId];
      if (pv.chiefComplaint !== undefined) {
        if ((callNow.chiefComplaint || '') === (pv.chiefComplaint || '')) {
          delete newPending[callId];
          changed = true;
          continue;
        }
      }

      if (pv.ageSex !== undefined) {
        const formatted = formatAgeSex(callNow.age, callNow.gender) || '';
        if (formatted === (pv.ageSex || '')) {
          delete newPending[callId];
          changed = true;
          continue;
        }
      }
    }

    if (changed) setPendingValues(newPending);
  }, [event?.calls, pendingValues, formatAgeSex]);

  const markPendingValue = (
    callId: string,
    field: EditableCallField,
    value: string
  ) => {
    setPendingValues((prev) => ({
      ...prev,
      [callId]: { ...(prev[callId] || {}), [field]: value },
    }));
  };

  return {
    notesTexts,
    setNotesTexts,
    notesFocusedRef,
    logTexts,
    setLogTexts,
    logFocusedRef,
    pendingValues,
    setPendingValues,
    markPendingValue,
  };
}
