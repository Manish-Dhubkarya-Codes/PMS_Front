import React from 'react';

interface Button2Props {
  value: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void; 
  disabled?: boolean;
  loading?: boolean;
}

const Button2: React.FC<Button2Props> = ({ value, onClick, disabled = false, loading = false }) => {
  return (
    <div
      onClick={!disabled && !loading ? onClick : undefined} // Disable onClick when disabled or loading
      className={`
        border border-black 
        rounded-[5px] 
        font-medium
        px-5 py-1 
        shadow-[0px_4px_4px_0px_#00000040] 
        flex items-center justify-center 
        text-white 
        text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px]
        cursor-${disabled || loading ? 'not-allowed' : 'pointer'}
        ${disabled ? 'bg-[#A3A3A3]' : loading ? 'bg-[#1B7BFF]' : 'bg-[#1B7BFF]'}
        ${disabled || loading ? 'opacity-70' : 'opacity-100'}
      `}
    >
      {value}
    </div>
  );
};

export default Button2;