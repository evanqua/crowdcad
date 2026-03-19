'use client';

import React, { createContext, useContext } from 'react';

/**
 * LiteContext provides a simple flag to indicate whether the current route is a Lite (local-only) page.
 * Lite pages must NOT import or use Firebase, Auth, Firestore, or any cloud services.
 * This context allows any Lite page to identify itself and helps prevent accidental cloud coupling.
 */
interface LiteContextValue {
  isLiteMode: boolean;
}

const LiteContext = createContext<LiteContextValue | undefined>(undefined);

export function LiteProvider({
  children,
  isLiteMode = false,
}: {
  children: React.ReactNode;
  isLiteMode?: boolean;
}) {
  return (
    <LiteContext.Provider value={{ isLiteMode }}>
      {children}
    </LiteContext.Provider>
  );
}

/**
 * Hook to check if the current page is running in Lite mode.
 * Returns { isLiteMode: boolean }.
 * Use this to conditionally render Lite-only UI or warn about cloud features not available in Lite.
 */
export function useLiteMode() {
  const context = useContext(LiteContext);
  if (!context) {
    // If context is not provided, assume cloud mode (default)
    return { isLiteMode: false };
  }
  return context;
}
