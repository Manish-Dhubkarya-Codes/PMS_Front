// components/UploadProgressRing.tsx
import React from "react";

interface Props {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  progressColor?: string;
  children?: React.ReactNode; // centered content: icon, pause/play glyph, spinner...
}

/** A WhatsApp-style circular progress ring. Pure SVG, no deps, animates via
 * CSS transition on stroke-dashoffset so updates stay smooth even with
 * frequent progress ticks. */
const UploadProgressRing: React.FC<Props> = ({
  progress,
  size = 44,
  strokeWidth = 3,
  trackColor = "#E2E8F0", // slate-200
  progressColor = "#0587F5", // matches the app's existing accent blue
  children,
}) => {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 200ms linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

export default UploadProgressRing;