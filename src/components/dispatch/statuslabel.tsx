// statuslabel.tsx
'use client';

import React from 'react';
import { HousePlus, Ambulance } from 'lucide-react';

/**
 * Icon shown alongside a status/outcome's translated label, keyed by the
 * internal status/outcome value (never the translated text, which varies by
 * dispatch vocabulary preset).
 */
const STATUS_ICONS: Record<string, typeof HousePlus> = {
  Transporting: HousePlus,
  Delivered: HousePlus,
  'Rolled from Scene': Ambulance,
  'Pending Transport': Ambulance,
  Transported: Ambulance,
};

type StatusLabelProps = {
  /** Internal status/outcome value — looked up in STATUS_ICONS, never rendered directly. */
  status: string;
  /** Translated (or destination-decorated) text to display. */
  text: string;
  /**
   * Force the icon off even when STATUS_ICONS has one for this status — used
   * when a real clinic name is already spelled out in `text` (e.g.
   * getTransportingLabel/getDeliveredLabel with multiple clinics), where the
   * generic icon would read as redundant clutter. Defaults to true.
   */
  showIcon?: boolean;
  className?: string;
};

/** Renders a status/outcome's label with its status-specific icon, when one exists. */
export default function StatusLabel({ status, text, showIcon = true, className }: StatusLabelProps) {
  const Icon = showIcon ? STATUS_ICONS[status] : undefined;
  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      <span>{text}</span>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
    </span>
  );
}
