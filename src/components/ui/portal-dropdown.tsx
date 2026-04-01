'use client';

import React, { ReactNode, RefObject, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

type PortalDropdownProps = {
  anchorRef: RefObject<HTMLElement>;
  isOpen: boolean;
  children: ReactNode;
  widthClass?: string;
  onClose?: () => void;
};

export default function PortalDropdown({
  anchorRef,
  isOpen,
  children,
  widthClass = 'w-auto',
  onClose,
}: PortalDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose?.();
      }
    }

    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [onClose, anchorRef]);

  if (!isOpen || !anchorRef.current) return null;

  const rect = anchorRef.current.getBoundingClientRect();
  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom + 4,
    left: rect.left,
    zIndex: 9999,
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={dropdownStyle}
      className={`inline-block bg-surface-deepest border border-surface-liner rounded shadow-lg ${widthClass} max-h-[60vh] overflow-auto whitespace-nowrap`}
    >
      {children}
    </div>,
    document.body
  );
}
