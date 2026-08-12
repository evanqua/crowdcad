'use client';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { BUILTIN_PRESETS, DEFAULT_PRESET_ID } from './presets';

/**
 * Dispatch vocabulary is a pure display-mapping layer keyed off stable
 * internal English strings (see terms.ts). Only render sites should call
 * `t(key)` — every comparison, stored value, and business-logic branch in
 * the dispatch page/components must keep using the raw English key
 * (e.g. `status === 'Delivered'`), never the translated label.
 */
interface DispatchVocabularyContextValue {
  t: (key: string) => string;
}

const DispatchVocabularyContext = createContext<DispatchVocabularyContextValue | null>(null);

export function DispatchVocabularyProvider({
  terms,
  children,
}: {
  terms: Record<string, string>;
  children: React.ReactNode;
}) {
  const t = useCallback((key: string) => terms[key] ?? key, [terms]);
  const value = useMemo(() => ({ t }), [t]);

  return (
    <DispatchVocabularyContext.Provider value={value}>
      {children}
    </DispatchVocabularyContext.Provider>
  );
}

/** Falls back to the CrowdCAD Default (identity) mapping outside a provider. */
export function useDispatchTerms(): DispatchVocabularyContextValue {
  const ctx = useContext(DispatchVocabularyContext);
  if (ctx) return ctx;
  return { t: (key: string) => BUILTIN_PRESETS[DEFAULT_PRESET_ID].terms[key] ?? key };
}

export function useDispatchTerm(key: string): string {
  return useDispatchTerms().t(key);
}
