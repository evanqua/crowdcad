'use client';

import { Spinner } from '@heroui/react';

interface LoadingScreenProps {
  /** Text shown below the spinner. Defaults to "Loading…" */
  label?: string;
  /**
   * "page"    – fills the viewport (used for full-page auth / data gates)
   * "section" – fills its parent container (used inside modals / panels)
   */
  variant?: 'page' | 'section';
}

export default function LoadingScreen({
  label = 'Loading…',
  variant = 'page',
}: LoadingScreenProps) {
  const base =
    'flex flex-col items-center justify-center gap-3';
  const wrapper =
    variant === 'page'
      ? `${base} w-full bg-surface-deepest min-h-[calc(100vh-72px)]`
      : `${base} w-full h-full min-h-[120px]`;

  return (
    <div className={wrapper}>
      <Spinner color="primary" size="lg" />
      {label && (
        <p className="text-sm text-surface-faint">{label}</p>
      )}
    </div>
  );
}
