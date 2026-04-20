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
  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const open = mounted && isOpen;

  return (
    <div
      className={`dispatch-expand-grid ${open ? 'dispatch-expand-grid--open' : ''}`}
      style={{
        ['--dispatch-expand-delay' as unknown as string]: `${delayMs}ms`,
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