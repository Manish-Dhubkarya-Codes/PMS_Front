import React, { useEffect, useState } from "react";
import { IoMdCloseCircle } from "react-icons/io";

interface FilterProps {
  setClose: (value: boolean) => void;
  filters: string[];
  setSelectedFilters: (filters: string[]) => void;
  singleSelect?: boolean; // Added singleSelect prop
  onClear?: () => void; // NEW: Optional onClear prop
}

const Filter: React.FC<FilterProps> = ({ filters, setClose, setSelectedFilters, singleSelect = false, onClear }) => {
  const [selected, setSelected] = useState<string[]>([]); // Array for selected filters
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update parent component's selectedFilters whenever local selected state changes
  useEffect(() => {
    setSelectedFilters(selected);
  }, [selected, setSelectedFilters]);

  const handleFilterChange = (filter: string) => {
    if (singleSelect) {
      // Single-select: Only the clicked filter is selected, others are deselected
      setSelected(selected.includes(filter) ? [] : [filter]);
    } else {
      // Multi-select: Toggle the filter in the array
      const newSelected = selected.includes(filter)
        ? selected.filter((f) => f !== filter)
        : [...selected, filter];
      setSelected(newSelected);
    }
  };

  const handleClearFilters = () => {
    setSelected([]);
    onClear?.(); // NEW: Call parent's onClear if provided
  };

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;

  return (
    <div className="flex flex-col text-black items-start mx-auto">
      <div className="w-full flex">
        <div className="w-full items-start flex flex-col justify-between">
          <div className="text-[12px] font-bold mb-2">Filter</div>
          <div className="font-bold text-[12px] mb-4 space-x-[2px]">
            <span
              className="hover:scale-110 hover:border-blue-400 px-2 py-1 rounded-sm border-[1.5px]  duration-150 transition transform cursor-pointer"
              onClick={handleClearFilters}
            >
              Clear filters
            </span>
          </div>
        </div>
        {(isXXS || isXS || isSM || isMD) && (
          <div onClick={() => setClose(false)} className="p-2 h-fit rounded-full">
            <IoMdCloseCircle size={20} />
          </div>
        )}
      </div>

      <div className="border-black border-[1.5px] bg-white rounded-xl py-5.5 pl-4 pr-8 xs:space-y-3 space-y-4 md:space-y-5 lg:space-y-6">
        {filters.map((filter) => (
          <label
            key={filter}
            className="flex items-center text-start space-x-3 text-black text-[12px] cursor-pointer"
          >
            <span className="relative w-4 h-4">
              <input
                type={singleSelect ? "radio" : "checkbox"} // Use radio for singleSelect, checkbox otherwise
                value={filter}
                checked={selected.includes(filter)}
                onChange={() => handleFilterChange(filter)}
                name={singleSelect ? "filter" : undefined} // Radio buttons need same name for mutual exclusivity
                className="appearance-none cursor-pointer w-4 h-4 rounded-full border-[1.5px] border-[#0141A0] checked:bg-[#011B40] checked:border-[#011B40]"
              />
            </span>
            <span>{filter}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default Filter;