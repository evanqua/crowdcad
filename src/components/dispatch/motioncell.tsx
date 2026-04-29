'use client';

import React from 'react';

type DispatchMotionCellProps = {
  isOpen: boolean;
  delayMs?: number;
  animate?: boolean;
  className?: string;
  children: React.ReactNode;
};

export default function DispatchMotionCell({
  isOpen,
  delayMs = 0,
  animate = false,
  className = '',
  children,
}: DispatchMotionCellProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // If animation is disabled, reset mounted and skip the RAF.
    if (!animate) {
      setMounted(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, [animate]);

  // Preserve the old "no animation" behavior when `animate` is false.
  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  const open = mounted && isOpen;

  return (
    <div
      className={`dispatch-expand-grid ${open ? 'dispatch-expand-grid--open' : ''}`}
      style={{
        ['--dispatch-expand-delay' as unknown as string]: `${open ? delayMs : 0}ms`,
      }}
      aria-hidden={!open}
    >
      <div className="dispatch-expand-inner">
        <div className={`dispatch-expand-fade ${open ? 'dispatch-expand-fade--open' : ''} ${className}`}>
          {children}
        </div>
      </div>
    </div>
  );
}