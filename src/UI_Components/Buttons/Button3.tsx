import React from 'react';

interface Button3Props {
  value: string;
  onClick?: () => void; // Optional onClick handler
}

const Button3: React.FC<Button3Props> = ({ value, onClick }) => {
  return (
    <div
    onClick={onClick}
      className={`sm:px-10 px-7 py-1 rounded-[7px] flex items-center justify-center text-white sm:text-[12px] text-[10px] font-medium cursor-pointer`}
      style={{
          background: 'linear-gradient(90deg, #012557 0%, #0251BD 100%)',
      }}
    >
      {value}
    </div>
  );
};

export default Button3;
