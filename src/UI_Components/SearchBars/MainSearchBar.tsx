import React from "react";
import { FiSearch } from "react-icons/fi";

interface MainSearchBarProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}

const MainSearchBar: React.FC<MainSearchBarProps> = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className="h-[30px] w-auto sm:w-[300px] md:w-[320px] lg:w-[349px] relative">
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="
          w-full h-full 
          pl-3 pr-10 
          text-black
          text-[14px] 
          font-medium
          tracking-[0.04rem]
          rounded-[5px]
          border-[1.5px] border-[#1B7BFF]
          bg-white
          outline-none
          placeholder-gray-500
        "
      />
      <FiSearch
        color="#343434"
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[16px]"
      />
    </div>
  );
};

export default MainSearchBar;