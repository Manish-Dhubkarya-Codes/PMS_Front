// Updated ProgressTracking.tsx
// Replace the entire component code with this:

import React from "react";
import { FaBriefcase } from "react-icons/fa";
import { RiMoneyRupeeCircleLine } from "react-icons/ri";

interface ProgressTrackingProps {
  height?: number;
  progress: { start: string; payment: string; work: string };
  onStepClick?: (index: number) => void;
  updateType?: 'payment' | 'work'; // Prop to specify update type
}

const ProgressTracking: React.FC<ProgressTrackingProps> = ({ height, progress, onStepClick, updateType }) => {
  const payment_num = parseFloat(progress.payment.replace('%', '')) || 0;
  const work_num = parseFloat(progress.work.replace('%', '')) || 0;
  const min_num = Math.min(payment_num, work_num);
  const payment_steps = Math.floor(payment_num / 20);
  const work_steps = Math.floor(work_num / 20);
  const completed_steps = Math.floor(min_num / 20);
  const stepCount = 5;
  const circleSize = 34;
  const connectorCount = stepCount - 1;
  const connectorHeight = height
    ? (height - stepCount * circleSize) / connectorCount
    : 55;

  return (
    <div
      className="flex flex-col items-center"
      style={{ height: height ? `${height}px` : "auto" }}
    >
      {[...Array(5).keys()].map((index) => {
        const previousCompleted = index > 0 && completed_steps >= index;
        const isPaymentDone = index < payment_steps;
        const isWorkDone = index < work_steps;
        // Make clickable based on updateType's steps
        const currentSteps = updateType === 'payment' ? payment_steps : work_steps;
        const isClickable = onStepClick && index === currentSteps;
        // Independent coloring
        const outerColor = index < payment_steps ? "border-[#104A99]" : "border-gray-300";
        const innerColor = index < work_steps ? "bg-[#1B7BFF]" : "bg-gray-300";
        return (
          <div key={index} className="flex flex-col items-center">
            {index !== 0 && (
              <div
                className={`w-px relative ${previousCompleted ? "bg-blue-500" : "bg-gray-300"}`}
                style={{ height: `${connectorHeight}px` }}
              ></div>
            )}
            
            <div
              className={`relative rounded-full flex items-center justify-center w-[40px] h-[40px] border-4 ${outerColor} ${isClickable ? "cursor-pointer hover:opacity-80" : ""}`}
              onClick={() => isClickable && onStepClick(index)}
            >
              <div className="absolute bottom-7 left-6 z-10">
            <RiMoneyRupeeCircleLine size={20} color={ isPaymentDone ? "#0EE647" : "#473834"} />
            </div>
              <div className={`absolute inset-[4px] flex items-center justify-center rounded-full ${innerColor}`}><FaBriefcase color={ isWorkDone ? "#FF2960" : "#473834"} size={10} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProgressTracking;