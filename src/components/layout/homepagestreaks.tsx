"use client";

import React from "react";

type StreakSpec = {
  top: string;
  width: string;
  height: string;
  color: string;
  opacity: number;
  fadeStop: number;
  xShift: string;
  ellipseWidth: string;
  ellipseHeight: string;
};

const STREAKS: StreakSpec[] = [
  { top: "-100vh", width: "420px", height: "2200px", color: "var(--streak-neutral-rgb)", opacity: 0.09, fadeStop: 50, xShift: "-1250px", ellipseWidth: "100%", ellipseHeight: "60%" },
  { top: "-30vh", width: "320px", height: "1800px", color: "var(--ripple-accent-rgb)", opacity: 0.06, fadeStop: 65, xShift: "20px", ellipseWidth: "70%", ellipseHeight: "100%" },
  { top: "8vh", width: "560px", height: "2800px", color: "255, 95, 95", opacity: 0.12, fadeStop: 45, xShift: "-1480px", ellipseWidth: "100%", ellipseHeight: "90%" },
  { top: "38vh", width: "360px", height: "2100px", color: "var(--ripple-accent-rgb)", opacity: 0.12, fadeStop: 56, xShift: "-640px", ellipseWidth: "92%", ellipseHeight: "100%" },
  { top: "166vh", width: "420px", height: "2400px", color: "255, 95, 95", opacity: 0.1, fadeStop: 58, xShift: "-920px", ellipseWidth: "86%", ellipseHeight: "70%" },
  { top: "196vh", width: "540px", height: "2600px", color: "var(--streak-neutral-rgb)", opacity: 0.11, fadeStop: 60, xShift: "-1480px", ellipseWidth: "60%", ellipseHeight: "85%" },
  { top: "272vh", width: "440px", height: "2600px", color: "var(--ripple-accent-rgb)", opacity: 0.09085, fadeStop: 56, xShift: "-1060px", ellipseWidth: "88%", ellipseHeight: "50%" },
  { top: "350vh", width: "600px", height: "2800px", color: "var(--streak-neutral-rgb)", opacity: 0.12, fadeStop: 55, xShift: "-1560px", ellipseWidth: "100%", ellipseHeight: "70%" },
  { top: "470vh", width: "460px", height: "2800px", color: "255, 95, 95", opacity: 0.09, fadeStop: 59, xShift: "-1120px", ellipseWidth: "90%", ellipseHeight: "70%" },
  { top: "588vh", width: "640px", height: "3000px", color: "var(--ripple-accent-rgb)", opacity: 0.0908, fadeStop: 54, xShift: "-1740px", ellipseWidth: "90%", ellipseHeight: "50%" },
  { top: "624vh", width: "400px", height: "3200px", color: "255, 95, 95", opacity: 0.09095, fadeStop: 62, xShift: "-980px", ellipseWidth: "74%", ellipseHeight: "80%" },
];

export default function HomePageStreaks() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        zIndex: 0,
        maskImage:
          "linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 0.96) 72%, rgba(0, 0, 0, 0.88) 88%, transparent 100%)",
      }}
    >
      {STREAKS.map((streak) => (
        <div
          key={`${streak.top}-${streak.width}-${streak.xShift}`}
          className="absolute"
          style={{
            top: streak.top,
            left: "50%",
            width: streak.width,
            height: streak.height,
            background: `radial-gradient(ellipse ${streak.ellipseWidth} ${streak.ellipseHeight} at center, rgba(${streak.color}, ${streak.opacity}), transparent ${streak.fadeStop}%)`,
            transform: `translateX(${streak.xShift}) rotate(320deg)`,
            transformOrigin: "top center",
          }}
        />
      ))}
    </div>
  );
}
