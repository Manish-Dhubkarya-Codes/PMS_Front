import React from "react";

interface TabsProps {
  tabs: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  totalUnreadAll?: number;  
  totalUnreadActive?: number;
  totalUnreadOngoing?: number;
  totalUnreadRequests?: number;
  totalUnreadAccepted?: number;
  totalUnreadRequested?: number;
  totalUnreadCompleted?: number;
}

const Navigation1: React.FC<TabsProps> = ({ 
  tabs, 
  activeTab, 
  setActiveTab, 
  totalUnreadAll,
  totalUnreadActive, 
  totalUnreadOngoing, 
  totalUnreadRequests,
  totalUnreadAccepted,
  totalUnreadRequested,
  totalUnreadCompleted
}) => {
  return (
    <div className="w-full py-2 px-4 overflow-x-auto no-scrollbar">
      <div
        className="inline-flex pl-2"
        style={{ transform: "rotate(0.2deg)" }}
      >
{tabs.map((tab, index) => {
  const isActive = activeTab === tab;
  const zIndex = tabs.length - index;
  const showBadge =
    (tab === "All Projects" && typeof totalUnreadAll === "number" && totalUnreadAll > 0) ||
    (tab === "Active" && typeof totalUnreadActive === "number" && totalUnreadActive > 0) ||
    (tab === "On-Going" && typeof totalUnreadOngoing === "number" && totalUnreadOngoing > 0) ||
    (tab === "Requests" && typeof totalUnreadRequests === "number" && totalUnreadRequests > 0) ||
    (tab === "Accepted" && typeof totalUnreadAccepted === "number" && totalUnreadAccepted > 0) ||
    (tab === "Requested" && typeof totalUnreadRequested === "number" && totalUnreadRequested > 0) ||
    (tab === "Completed" && typeof totalUnreadCompleted === "number" && totalUnreadCompleted > 0);

  const badgeCount =
    tab === "All Projects" ? totalUnreadAll :
    tab === "Active" ? totalUnreadActive :
    tab === "On-Going" ? totalUnreadOngoing :
    tab === "Requests" ? totalUnreadRequests :
    tab === "Accepted" ? totalUnreadAccepted :
    tab === "Requested" ? totalUnreadRequested :
    tab === "Completed" ? totalUnreadCompleted : 0;

  return (
    <div
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`relative font-dmsans text-black flex items-center justify-center border-[1.5px] border-[#2C6BC1]
        cursor-pointer select-none rounded-l-md rounded-r-md whitespace-nowrap
        text-[10px] sm:text-[12px] md:text-[14px] lg:text-[15px]
        h-[30px] sm:h-[34px] md:h-[36px] lg:h-[40px]
        ml-[-10px]
        transition-all duration-300 ease-in-out
        ${index === 0 ? "skew-x-[-16deg] z-5" : "transform skew-x-[-16deg]"}
        ${isActive
          ? "bg-white font-medium scale-[1.15] translate-y-[2.5px] shadow-md"
          : "bg-[#F8FAFC] font-normal scale-100 translate-y-0 shadow-none"
        }
      `}
      style={{ zIndex, width: "158px" }}  
    >
      <div className="transform -tracking-[0.03rem] skew-x-[16deg] flex items-center justify-center w-full px-2">
        {tab}
        {showBadge && (
          <span className="ml-2 absolute -top-1.5 right-3 bg-green-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {badgeCount}
          </span>
        )}
      </div>
    </div>
  );
})}
      </div>
    </div>
  );
};

export default Navigation1;