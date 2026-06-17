import React from 'react';
import { FiLogOut } from 'react-icons/fi';

// The props interface remains the same
interface LogoutPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const LogoutPopup: React.FC<LogoutPopupProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) {
    return null;
  }

  return (
    // Main overlay with a dark background to make the glassy pop-up stand out
    <div className="fixed inset-0 z-50 backdrop-blur-lg flex items-center justify-center p-6">
      
      {/* Glassmorphism container */}
      <div 
        className="
          relative flex w-full max-w-xs flex-col items-center gap-4 
          rounded-2xl border border-white/20 bg-white p-6 
          text-center text-white 
        "
      >
        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/10">
          <FiLogOut className="text-red-500" size={25} />
        </div>

        {/* Text Content */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-sky-500">
            Are you sure you want to log out?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full flex-col gap-2.5">
          <div
            onClick={onConfirm}
className="
  w-full cursor-pointer 
  hover:scale-105 
  duration-300 
  bg-red-400 
  rounded-lg  
  py-2.5 
  text-sm 
  font-semibold 
  transition-transform
"
          >
            Yes, Log Out
          </div>
          <div
            onClick={onClose}
className="
  w-full cursor-pointer 
  hover:scale-105 
  duration-300 
  bg-gray-300 
  rounded-lg  
  py-2.5 
  text-sm 
  font-semibold 
  transition-transform
"          >
            Cancel
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoutPopup;