// Updated ProfileWithDesignation component
import React, { useEffect, useState } from "react";
import { FaUser, FaEllipsisV } from "react-icons/fa";
import { serverURL } from "../../BackendConnections/FetchBackendServices";

interface ProfileWithDesignationProps {
  Status?: string;
  EmployeeName: string;
  IsSmall: boolean;
  Designation?: string;
  borderColor?: string;
  profile?: string | null;
  onAssign?: () => void;
  onDecline?: () => void;
  isPending?: boolean;
  onRemoveAsTL?: () => void;
  onPromoteToTL?: (securityKey: string) => void;
  isTeamLeader?: boolean;
  // showMonitorOption?: boolean;
  employeeId?: string;
  projectId?: string;
  onMakeMonitor?: (employeeId: string, projectId: string) => void;
  onRemoveMonitor?: (employeeId: string, projectId: string) => void; // NEW: Added prop for remove monitor
}

const ProfileWithDesignation: React.FC<ProfileWithDesignationProps> = ({
  Status,
  EmployeeName,
  IsSmall,
  Designation,
  borderColor,
  profile,
  onAssign,
  onDecline,
  isPending,
  onRemoveAsTL,
  onPromoteToTL,
  isTeamLeader,
  // showMonitorOption = false,
  // employeeId,
  // projectId,
  // onMakeMonitor,
  // onRemoveMonitor, // NEW: Destructure the new prop
}) => {
  const [width, setWidth] = useState(window.innerWidth);
  const [showMenu, setShowMenu] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [securityKeyInput, setSecurityKeyInput] = useState("");
const [actionLoading, setActionLoading] = useState<
  "assign" | "decline" | null
>(null);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu && event.target && !(event.target as Element).closest('.profile-menu')) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;

 const handleAssignClick = () => {
  if (!onAssign || !isPending || actionLoading) return;

  setActionLoading("assign");
  onAssign();
};

const handleDeclineClick = () => {
  if (!onDecline || !isPending || actionLoading) return;

  setActionLoading("decline");
  onDecline();
};

  const handlePromoteClick = () => {
    if (onPromoteToTL && !isTeamLeader) {
      setShowPromoteModal(true);
    }
  };

  // const handleMakeMonitorClick = () => {
  //   if (onMakeMonitor && employeeId && projectId) {
  //     onMakeMonitor(employeeId, projectId);
  //     setShowMenu(false);
  //   }
  // };

  // const handleRemoveMonitorClick = () => {
  //   if (onRemoveMonitor && employeeId && projectId) {
  //     onRemoveMonitor(employeeId, projectId);
  //     setShowMenu(false);
  //   }
  // };

  const getStatusBgColor = () => {
    if (Status === "Assigned" || Status === "Assigned By TL") return "bg-[#1B7BFF]";
    if (Status === "Declined") return "bg-[#FF0000]";
    return "bg-[#1B7BFF]";
  };

  const buttonContainerStyle = {
    boxShadow: "0px 0px 0px 0px ",
  };

  const buttonClass = `flex items-center justify-start rounded-[5px] border-[1px] border-black mb-5 pr-2 pl-7 text-white font-medium cursor-pointer`;

  const smallButtonClass = `${buttonClass} ${isXS ? "py-1" : isSM ? "py-1" : isMD ? "py-1.5" : isLG ? "py-2" : isXL ? "py-2" : is2XL ? "py-2" : "py-1.5"} ${
    isMD || isLG || isXL || is2XL ? "text-[12px]" : "text-[10px]"
  }`;

  const largeButtonClass = `${buttonClass} ${isXS ? "py-2" : isSM ? "py-2" : isMD ? "py-2.5" : isLG ? "py-3" : isXL ? "py-3" : is2XL ? "py-3" : "py-2"} ${
    isMD || isLG || isXL || is2XL ? "text-[12px]" : "text-[10px]"
  }`;

  const buttonContainerClass = `flex absolute max-w-[320px] min-w-[160px] space-x-2 items-center justify-start`;

  const smallContainerClass = `${buttonContainerClass} ${isXS ? "ml-48" : isSM ? "ml-50" : isMD ? "ml-50" : isLG ? "ml-52" : isXL ? "ml-55" : is2XL ? "ml-55" : "ml-45"}`;

  const largeContainerClass = `${buttonContainerClass} ${isXS ? "ml-48" : isSM ? "ml-50" : isMD ? "ml-50" : isLG ? "ml-52" : isXL ? "ml-55" : is2XL ? "ml-55" : "ml-45"}`;

  return (
    <div className="flex items-start relative" style={{ cursor: "pointer" }}>
      {/* Dropdown Menu */}
      {(isTeamLeader) && (
        <div className="absolute top-0 right-35 z-10">
          <FaEllipsisV
            size={12}
            className="text-gray-500 cursor-pointer"
            onClick={() => setShowMenu(!showMenu)}
          />
          {showMenu && (
            <div className="profile-menu absolute -right-10 top-7 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[150px]">
              {isTeamLeader && onRemoveAsTL && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAsTL();
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Remove from Team Leader
                </button>
              )}
              {/* {showMonitorOption && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (Status === "Project Monitor") {
                      handleRemoveMonitorClick();
                    } else {
                      handleMakeMonitorClick();
                    }
                  }}
                  className="block cursor-pointer w-full text-left px-4 py-2 text-sm text-gray-700"
                >
                  {Status === "Project Monitor" ? "Remove as Monitor" : "Make Project Monitor"}
                </div>
              )} */}
              {!isTeamLeader && onPromoteToTL && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePromoteClick();
                    setShowMenu(false);
                  }}
                  className="block cursor-pointer w-full text-left px-4 py-2 text-sm text-gray-700"
                >
                  Promote to Team Leader
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal for Promoting to Team Leader */}
      {showPromoteModal && !isTeamLeader && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Promote to Team Leader</h3>
            <p className="mb-4">Employee: {EmployeeName}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Security Key (Required):</label>
              <input
                type="text"
                value={securityKeyInput}
                onChange={(e) => setSecurityKeyInput(e.target.value)}
                placeholder="Enter security key"
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowPromoteModal(false);
                  setSecurityKeyInput("");
                }}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (securityKeyInput.trim()) {
                    onPromoteToTL?.(securityKeyInput.trim());
                    setShowPromoteModal(false);
                    setSecurityKeyInput("");
                  } else {
                    alert("Security Key is required.");
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Promote
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div
            className={`${!profile ? "p-4" : ""} relative z-1 rounded-full w-fit bg-white ${
              borderColor ? borderColor : "border-gray-400"
            } border-3`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {profile ? (
              <img
                src={`${serverURL}/files/${profile}`}
                alt={EmployeeName}
                className={`rounded-full ${
                  IsSmall
                    ? isXS
                      ? "w-15 h-15"
                      : isSM
                      ? "w-16 h-16"
                      : isMD
                      ? "w-17 h-17"
                      : isLG
                      ? "w-18 h-18"
                      : isXL
                      ? "w-19 h-19"
                      : is2XL
                      ? "w-18 h-18"
                      : "w-14 h-14"
                    : isXS
                    ? "w-19 h-19"
                    : isSM
                    ? "w-20 h-20"
                    : isMD
                    ? "w-21 h-21"
                    : isLG
                    ? "w-22 h-22"
                    : isXL
                    ? "w-23 h-23"
                    : is2XL
                    ? "w-24 h-24"
                    : "w-19 h-19"
                } object-cover`}
              />
            ) : (
              <>
                {IsSmall ? (
                  <FaUser
                    size={isXS ? 25 : isSM ? 30 : isMD ? 35 : isLG ? 40 : isXL ? 45 : is2XL ? 40 : 15}
                    color="#9e9e9e"
                  />
                ) : (
                  <FaUser
                    size={isXS ? 40 : isSM ? 45 : isMD ? 50 : isLG ? 55 : isXL ? 60 : is2XL ? 65 : 30}
                    color="#9e9e9e"
                  />
                )}
              </>
            )}
          </div>
          {IsSmall ? (
            <div style={buttonContainerStyle} className={smallContainerClass}>
              {!isPending ? (
                (Status || Designation) && (
                  <div className={`${smallButtonClass} ${getStatusBgColor()}`}>
                    {Status || Designation}
                  </div>
                )
              ) : (
                <div className="relative mb-5 w-[200px] h-[35px] flex rounded overflow-hidden">
  {actionLoading ? (
    <div className="w-full h-full flex items-center justify-center bg-gray-400 text-white cursor-not-allowed">
      {actionLoading === "assign"
        ? "Assigning..."
        : "Declining..."}
    </div>
  ) : (
    <>
      <div
        className="absolute top-0 left-0 w-[55%] h-full bg-[#1B7BFF] clip-assign flex items-center justify-center text-white cursor-pointer"
        onClick={handleAssignClick}
      >
        Assign
      </div>

      <div
        className="absolute top-0 right-0 w-[55%] h-full bg-[#FF0000] clip-decline flex items-center justify-center text-white cursor-pointer"
        onClick={handleDeclineClick}
      >
        Decline
      </div>
    </>
  )}
</div>
              )}
            </div>
          ) : (
            <div style={buttonContainerStyle} className={largeContainerClass}>
              {!isPending ? (
                (Status || Designation) && (
                  <div className={`${largeButtonClass} ${getStatusBgColor()}`}>
                    {Status || Designation}
                  </div>
                )
              ) : (
             <div className="relative w-[200px] h-[40px] flex rounded overflow-hidden">
  {actionLoading ? (
    <div className="w-full h-full flex items-center justify-center bg-gray-400 text-white cursor-not-allowed">
      {actionLoading === "assign"
        ? "Assigning..."
        : "Declining..."}
    </div>
  ) : (
    <>
      <div
        className="absolute top-0 left-0 w-[55%] h-full bg-[#1B7BFF] clip-assign flex items-center justify-center text-white cursor-pointer"
        onClick={handleAssignClick}
      >
        Assign
      </div>

      <div
        className="absolute top-0 right-0 w-[55%] h-full bg-[#FF0000] clip-decline flex items-center justify-center text-white cursor-pointer"
        onClick={handleDeclineClick}
      >
        Decline
      </div>
    </>
  )}
</div>
              )}
            </div>
          )}
          <style>{`
            .clip-assign {
              clip-path: polygon(0 0, 100% 0, 80% 100%, 0% 100%);
            }
            .clip-decline {
              clip-path: polygon(20% 0, 100% 0, 100% 100%, 0% 100%);
            }
          `}</style>
          <div
            className={`${isMD || isLG || isXL || is2XL ? "text-[12px]" : "text-[10px]"} pt-1 font-normal text-black`}
          >
            {EmployeeName}
          </div>
          <div
            className={`text-black absolute ${
              isMD || isLG || isXL || is2XL
                ? "mt-12 ml-35 text-[12px]"
                : "mt-10 ml-28 text-[10px]"
            } font-medium -tracking-[0.02rem]`}
          >
            Profile
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileWithDesignation;