import React from "react";
import { IoSearch } from "react-icons/io5";

interface EmployeeSearchBarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const EmployeeSearchBar: React.FC<EmployeeSearchBarProps> = ({ value, onChange }) => {
  return (
    <div className="w-full flex text-black justify-center">
      <div
        className="
          relative 
          w-[100%] 
          h-[34px] 
          bg-white 
          border-[1.5px]
          border-blue-400
          rounded-[5px]
          py-1 
          pl-6
          pr-4 
          flex 
          items-center
          shadow-sm
        "
      >
        <input
          type="text"
          placeholder="Search..."
          value={value}
          onChange={onChange}
          className="
            w-full 
            h-full 
            bg-transparent 
            border-0 
            text-[14px] 
            font-medium
            tracking-[0.04rem]
            border-b-[1.5px] 
            border-[#C2C2C2]
            focus:border-[#1B7BFF]
            focus:outline-none
            placeholder-[#C2C2C2]
            text-black
            text-sm
            pb-[2px]
          "
        />
        <IoSearch size={15} color="#343434" className="ml-2" />
      </div>
    </div>
  );
};

export default EmployeeSearchBar;