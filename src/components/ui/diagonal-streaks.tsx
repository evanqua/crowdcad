"use client";

import React from "react";

export const DiagonalStreaks = () => {
  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <div
        className="absolute"
        style={{
          top: '-100%',
          left: '50%',
          width: '500px',
          height: '7000px',
          background: 'radial-gradient(ellipse 100% 50% at center, rgba(var(--ripple-accent-rgb), 0.09), transparent 50%)',
          transform: 'translateX(-2800px) rotate(320deg)',
          transformOrigin: 'top center',
        }}
      />

      <div
        className="absolute"
        style={{
          top: '-27%',
          left: '50%',
          width: '300px',
          height: '6000px',
          background: 'radial-gradient(ellipse 100% 50% at center, rgba(var(--ripple-accent-rgb), 0.09), transparent 55%)',
          transform: 'translateX(-2800px) rotate(320deg)',
          transformOrigin: 'top center',
        }}
      />

      <div
        className="absolute"
        style={{
          top: '-15%',
          left: '50%',
          width: '400px',
          height: '3500px',
          background: 'radial-gradient(ellipse 70% 50% at center, rgba(240, 28, 28, 0.13), transparent 65%)',
          transform: 'translateX(-400px) rotate(320deg)',
          transformOrigin: 'top center',
        }}
      />

      <div
        className="absolute"
        style={{
          top: '0%',
          left: '50%',
          width: '760px',
          height: '4800px',
          background: 'radial-gradient(ellipse 100% 50% at center, rgba(233, 233, 240, 0.09), transparent 45%)',
          transform: 'translateX(-2400px) rotate(320deg)',
          transformOrigin: 'top center',
        }}
      />

      <div
        className="absolute"
        style={{
          top: '20%',
          left: '50%',
          width: '600px',
          height: '6000px',
          background: 'radial-gradient(ellipse 100% 50% at center, rgba(255, 89, 89, 0.15), transparent 50%)',
          transform: 'translateX(-2200px) rotate(320deg)',
          transformOrigin: 'top center',
        }}
      />

    </div>
  );
};
