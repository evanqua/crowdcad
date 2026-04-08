import React from 'react';

export default function MarkerPlacementInstruction() {
  return (
    <div className="absolute left-3 top-3 rounded-lg border border-status-blue/50 bg-surface-deepest/95 px-3 py-2 z-20 pointer-events-none">
      <p className="text-xs text-status-blue">Click on the map to place a location marker</p>
    </div>
  );
}
