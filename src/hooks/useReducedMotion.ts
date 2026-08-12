'use client';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ccad-reduced-motion';

function applyReducedMotionClass(enabled: boolean) {
  const root = document.documentElement;
  root.classList.toggle('reduce-motion', enabled);
  root.setAttribute('data-reduced-motion', String(enabled));
}

export function useReducedMotion() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    try {
      setEnabledState(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    applyReducedMotionClass(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // localStorage unavailable — in-memory state still updates
    }
  }, []);

  return { enabled, setEnabled };
}
