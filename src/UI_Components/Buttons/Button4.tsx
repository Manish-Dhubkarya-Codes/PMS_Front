import React from 'react';

interface Button3Props {
  value1: any;
  value2: any;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const Button4: React.FC<Button3Props> = ({ value1, value2, onClick }) => {
  return (
    <div
    onClick={onClick}
      className={`
        sm:px-7 px-5 py-2 
        
        
        font-medium
        leading-5
        border-[1.5px]
        border-black
        rounded-[25px] 
        flex flex-col items-center justify-center 
        -tracking-[0.03rem] 
        text-white sm:text-[16px] text-[12px]
        cursor-pointer
      `}
      style={{
        background: 'radial-gradient(50% 322.36% at 50% 50%, #011B40 0%, #0348A6 100%)',
      }}
    >
      <div>{value1}</div>
      <div>{value2}</div>
    </div>
  );
};

export default Button4;
