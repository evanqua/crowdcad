// Mirrors the "boxy grid" design system used on the marketing site's
// home/features pages (src/components/design/gridsystem.tsx there):
// sharp-cornered cells that share border lines instead of individual
// rounded/gapped cards, with a hover-only tint. Reimplemented locally,
// scoped to this page, since core can't import from the root app.
export const GRID_WRAPPER = 'border-t border-l border-surface-liner/70';
export const GRID_CELL =
  'border-r border-b border-surface-liner/70 bg-transparent hover:bg-surface-liner/10 transition-colors duration-150';
