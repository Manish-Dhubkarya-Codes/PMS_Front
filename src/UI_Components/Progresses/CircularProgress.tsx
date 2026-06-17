import React from 'react';

interface CircularProgressProps {
  progress: number; // percentage (0–100)
  size?: number;    // width/height in px
  strokeWidth?: number; // thickness of the ring
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 63,
  strokeWidth = 10,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="gradientStroke" x1="0%" y1="100%" x2="10%" y2="0%">
            <stop offset="0%" stopColor="#4e12ef" />
            <stop offset="100%" stopColor="#7142f0" />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#gradientStroke)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
  <span className="text-[14px] font-bold bg-gradient-to-r from-blue-600 to-sky-400 bg-clip-text text-transparent">
    {progress}%
  </span>
</div>

    </div>
  );
};

export default CircularProgress;