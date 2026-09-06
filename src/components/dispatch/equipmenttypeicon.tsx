// equipmenttypeicon.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Briefcase } from 'lucide-react';
import type { EquipmentIconType } from '@/lib/equipmentIcon';

type Props = {
  type: EquipmentIconType;
  className?: string;
};

/**
 * Renders an equipment type's icon for inline text contexts (status pills,
 * dropdown options) — same three visuals as the venue map's EquipmentMarker
 * (wheelchair.svg, gurney.svg, or a medical briefcase for 'aed'/default),
 * but without the map's forced white-on-badge styling.
 *
 * wheelchair.svg/gurney.svg are baked white — fine on the map's colored
 * badge, illegible on these pills' surface in light mode. Unlike a lucide
 * icon, an <Image> pointing at an SVG file can't be recolored with a
 * `fill`/`stroke`/`currentColor` prop (the color is inside the file), so
 * this renders both a white and a black copy and lets Tailwind's `dark:`
 * variant pick one via plain CSS — no theme-detection JS or hydration
 * flash. The map's own EquipmentMarker is untouched and always white.
 */
export default function EquipmentTypeIcon({ type, className = 'w-4 h-4 shrink-0' }: Props) {
  if (type === 'wheelchair') {
    return (
      <>
        <Image src="/map/wheelchair.svg" alt="Wheelchair" width={16} height={16} className={`${className} hidden dark:block`} />
        <Image src="/map/wheelchair-black.svg" alt="Wheelchair" width={16} height={16} className={`${className} block dark:hidden`} />
      </>
    );
  }
  if (type === 'stretcher') {
    return (
      <>
        <Image src="/map/gurney.svg" alt="Gurney" width={16} height={16} className={`${className} hidden dark:block`} />
        <Image src="/map/gurney-black.svg" alt="Gurney" width={16} height={16} className={`${className} block dark:hidden`} />
      </>
    );
  }
  return <Briefcase className={className} aria-hidden="true" />;
}

/**
 * Word shown in place of an equipment-run status's "Eq" suffix, deliberately
 * NOT routed through the dispatch vocabulary's t() — 'Delivered Eq'/
 * 'En Route Eq' still translate to their plain, unmodified selves everywhere
 * else (the sidebar team card's status Select shows the same two keys and
 * has no equipment-icon/name context to complete this phrasing with). Scoped
 * to the call tracker's per-call chip, which does have that context.
 */
export function getEquipmentStatusWord(status: string): string {
  if (status === 'Delivered Eq') return 'Delivered';
  if (status === 'En Route Eq') return 'En Route';
  return status;
}
