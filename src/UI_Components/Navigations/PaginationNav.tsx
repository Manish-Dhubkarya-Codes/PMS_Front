import React from 'react';
import { IoMdArrowDropleft, IoMdArrowDropright } from 'react-icons/io';

interface PaginationNavProps {
  total: number;
  current: number;
  onPageChange: (page: number) => void;
}

const PaginationNav: React.FC<PaginationNavProps> = ({ total, current, onPageChange }) => {
  const handlePrev = () => {
    if (current > 1) {
      onPageChange(current - 1);
    }
  };

  const handleNext = () => {
    if (current < total) {
      onPageChange(current + 1);
    }
  };

  return (
    <div className="flex items-center select-none justify-center space-x-3 bg-[#e6e6e6] border border-black px-5 py-1.5 rounded-full w-fit">
      <IoMdArrowDropleft
        onClick={handlePrev}
        className={`cursor-pointer ${current === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
        size={20}
      />
      <span className="text-sm font-medium text-black">
        {current} / {total}
      </span>
      <IoMdArrowDropright
        onClick={handleNext}
        className={`cursor-pointer ${current === total ? 'opacity-50 cursor-not-allowed' : ''}`}
        size={20}
      />
    </div>
  );
};

export default PaginationNav;