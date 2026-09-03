import type { CSSProperties } from 'react';

/**
 * Subtle checkerboard behind a venue/event map, so the letterboxed area
 * outside the map image (fully transparent there) reads as "outside the
 * image" rather than a flat, ambiguous fill. Shared by every map display
 * (event creation, venue creation) so they read as the same surface.
 */
export const MAP_CHECKER_BG: CSSProperties = {
  backgroundColor: 'hsl(var(--surface-bg-1))',
  backgroundImage:
    'linear-gradient(45deg, hsl(var(--surface-bg-2)) 25%, transparent 25%), ' +
    'linear-gradient(-45deg, hsl(var(--surface-bg-2)) 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, hsl(var(--surface-bg-2)) 75%), ' +
    'linear-gradient(-45deg, transparent 75%, hsl(var(--surface-bg-2)) 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
};
