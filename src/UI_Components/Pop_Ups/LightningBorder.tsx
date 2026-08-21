import React from "react";

interface LightningBorderProps {
  children: React.ReactNode;
  className?: string;
}

const LightningBorder: React.FC<LightningBorderProps> = ({ children, className = "" }) => {
  return (
    <div className={`lightning-frame ${className}`}>
      <div className="lightning-spin" aria-hidden="true" />
      <div className="lightning-spin lightning-spin-glow" aria-hidden="true" />
      <div className="lightning-inner">{children}</div>
    </div>
  );
};

export default LightningBorder;
