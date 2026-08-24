'use client';

import React from 'react';

type DispatchMotionCellProps = {
  isOpen: boolean;
  delayMs?: number;
  animate?: boolean;
  className?: string;
  children: React.ReactNode;
  // Opt-in only: most consumers (call/clinic tracking rows) rely on the
  // permanent overflow:hidden here to keep truncated text clipped to width,
  // not just height. Only set this for content whose OWN bottom edge can get
  // clipped by height rounding once open (e.g. a bordered/rounded box like a
  // textarea) and that doesn't need horizontal clipping.
  overflowVisibleWhenOpen?: boolean;
};

export default function DispatchMotionCell({
  isOpen,
  delayMs = 0,
  animate = false,
  className = '',
  children,
  overflowVisibleWhenOpen = false,
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
      <div className={`dispatch-expand-inner ${open && overflowVisibleWhenOpen ? 'dispatch-expand-inner--open' : ''}`}>
        <div className={`dispatch-expand-fade ${open ? 'dispatch-expand-fade--open' : ''} ${className}`}>
          {children}
        </div>
      </div>
    </div>
  );
}