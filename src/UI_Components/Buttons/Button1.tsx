import React from 'react';

interface Button1Props {
  value: string;
  gradientType?: string;
  text?:string;
  width?:string;
}

const Button1: React.FC<Button1Props> = ({ value, gradientType, text, width }) => {
  const gradient =
    gradientType === 'gradient1'
      ? 'conic-gradient(from 90deg at 50% 50%, #011B40 0deg, #0348A6 360deg)'
      : 'conic-gradient(from 90deg at 50% 50%, #474747 0deg, #9A9A9A 360deg)';

  return (
    <div
      className={`
        text-white 
        font-semibold 
        ${text?"text-[10px]":"text-[12px]"} sm:text-[13px] md:${text?`${text}`:"text-[14px]"} lg: ${text?`${text}`:"text-[14px]"} 
       ${width?width:"px-5 sm:px-7 md:px-10"}  
        py-1 sm:py-1.5 md:py-2 
        cursor-pointer 
        border border-black 
        shadow-[2px_3px_4px_0px_black]
        inline-block
        text-center
      `}
      style={{
        background: gradient,
      }}
    >
      {value}
    </div>
  );
};

export default Button1;
