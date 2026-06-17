import { FaUser, FaEllipsisV, FaBolt } from "react-icons/fa";
import ProfileWithDesignation from "../../UI_Components/Profile/ProfileWithDesignation";
import { useEffect, useState } from "react";
import { getData, postData, serverURL } from "../../BackendConnections/FetchBackendServices";
import { BlinkBlur, Commet } from "react-loading-indicators";

interface Employee {
  employeeId: string;
  employeeName: string;
  employeeDesignation: string;
  employeeMail: string;
  employmentID: string;
  gender: string;
  employeePic: string | null;
  role: "Employee" | "Team Leader";
  securityKey: string | null;
}

interface AllEmployeeListProps {
  selectedDepartment: string;
}

const AllEmployeeList: React.FC<AllEmployeeListProps> = ({ selectedDepartment }) => {
  const [width, setWidth] = useState(window.innerWidth);
  const [teamLeaders, setTeamLeaders] = useState<Employee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmployeeMenu, setShowEmployeeMenu] = useState<string | null>(null);
  const [showPromotePopup, setShowPromotePopup] = useState(false);
  const [selectedEmployeeForPromote, setSelectedEmployeeForPromote] = useState<Employee | null>(null);
  const [securityKeyInput, setSecurityKeyInput] = useState("");
  const [apiLoading, setAPILoading]=useState(false);


  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getData('employees/fetch_employees_list');
        if (response.status) {
          const data = response.data as Employee[];
          const filteredData = data.filter(emp => {
            const match = emp.employeeDesignation.match(/\((.*?)\)$/);
            const department = match ? match[1] : "";
            return department === selectedDepartment;
          });
          setTeamLeaders(filteredData.filter(emp => emp.role === "Team Leader"));
          setEmployees(filteredData.filter(emp => emp.role === "Employee"));
        } else {
          setError(response.data?.message || "Failed to fetch employees.");
        }
      } catch (err) {
        setError("Failed to fetch employees. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [selectedDepartment]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmployeeMenu && !(event.target as HTMLElement).closest('.employee-menu')) {
        setShowEmployeeMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmployeeMenu]);

  // Handle demoting Team Leader to Employee
  const handleRemoveAsTeamLeader = async (employeeId: string) => {
    setAPILoading(true);
    try {
      const response = await postData('employees/change_employees_role', {
        employeeId,
        role: 'Employee',
        securityKey: null
      });
      if (response.status) {
        const tlIndex = teamLeaders.findIndex(tl => tl.employeeId === employeeId);
        if (tlIndex !== -1) {
          const demotedTL: Employee = { ...teamLeaders[tlIndex], role: "Employee", securityKey: null };
          setTeamLeaders(prev => prev.filter((_, i) => i !== tlIndex));
          setEmployees(prev => [...prev, demotedTL]);
        }
      } else {
        setError(response.data?.message || "Failed to remove Team Leader role.");
      }
    } catch (err) {
      setError("Failed to remove Team Leader role. Please try again.");
    } finally {
    setAPILoading(false);
  }
  };

  // Handle promoting Employee to Team Leader
  const handlePromoteToTeamLeader = async () => {
    if (!selectedEmployeeForPromote || !securityKeyInput.trim()) {
      setError("Security Key is required.");
      return;
    }
     setAPILoading(true);
    try {
      const response = await postData('employees/change_employees_role', {
        employeeId: selectedEmployeeForPromote.employeeId,
        role: 'Team Leader',
        securityKey: securityKeyInput.trim()
      });
      if (response.status) {
        const empIndex = employees.findIndex(emp => emp.employeeId === selectedEmployeeForPromote.employeeId);
        if (empIndex !== -1) {
          const promotedEmp: Employee = { ...employees[empIndex], role: "Team Leader", securityKey: securityKeyInput.trim() };
          setEmployees(prev => prev.filter((_, i) => i !== empIndex));
          setTeamLeaders(prev => [...prev, promotedEmp]);
        }
        setShowPromotePopup(false);
        setSelectedEmployeeForPromote(null);
        setSecurityKeyInput("");
        setShowEmployeeMenu(null);
      } else {
        setError(response.data?.message || "Failed to promote to Team Leader.");
      }
    } catch (err) {
      setError("Failed to promote to Team Leader. Please try again.");
    }
    finally {
    setAPILoading(false);
    }
  };

  // Function to extract designation without department
  const getDesignationWithoutDepartment = (designation: string): string => {
    return designation.replace(/\s*\(.*?\)\s*$/, '').trim();
  };

  const isXS = width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;

  if (loading) {
    return <div className={`pt-[2vh] flex text-gray-500`}>
      <Commet color="#32cd32" size="medium" text="Loading requests..." textColor="#000" />
    </div>
  }

  if (error) {
    return <div className="text-red-500 text-[14px] font-normal mt-7">Error: {error}</div>;
  }
    const generateKey = () => {
    const randomKey = Math.random().toString(36).substring(2, 10).toUpperCase();
    setSecurityKeyInput(randomKey);
  };
   if (apiLoading) {
    return (
        <div className="w-full h-[40vh] flex items-center justify-center bg-white backdrop-blur-md">
  <BlinkBlur color="#32cd32" size="large" text="" textColor="" />
</div>
    );
  }
  return (
    <div className={`flex flex-col w-full text-[12px]  space-y-10`}>
      {/* Team Leaders */}
      <div className="w-full flex items-start flex-col space-y-5">
      <div className="flex items-center gap-3">
  <div className="w-1.5 h-8 bg-blue-600 rounded-full" /> 
  <h2 className={`${isXS || isSM ? "text-[16px]" : "text-[20px]"} font-bold text-slate-800 tracking-tight uppercase`}>
    Team Leaders <span className="text-slate-400 font-medium ml-1">/ {selectedDepartment}</span>
  </h2>
</div>

        {/* Small screen: Horizontal Scroll */}
        <div className="block md:hidden pb-2 overflow-x-auto">
          <div className="flex gap-5 w-max items-end">
            {teamLeaders.length > 0 ? (
              teamLeaders.map((leader, index) => (
                <div key={leader.employeeId} className="min-w-[220px] flex-shrink-0 relative">
                  <ProfileWithDesignation
                    IsSmall={index !== 0}
                    Designation={getDesignationWithoutDepartment(leader.employeeDesignation)}
                    EmployeeName={leader.employeeName}
                    borderColor="border-[#1B7BFF]"
                    profile={leader.employeePic}
                    onRemoveAsTL={() => handleRemoveAsTeamLeader(leader.employeeId)}
                    isTeamLeader={true}
                  />
                </div>
              ))
            ) : (
              <div className="text-[#000000] text-[14px] font-normal">
                No team leaders found in {selectedDepartment} department
              </div>
            )}
          </div>
        </div>

        {/* Medium and up: Grid Layout */}
          {teamLeaders.length > 0 ? (
            teamLeaders.map((leader, index) => (
              // changeee
        <div className={`hidden md:grid items-end  custom-indent-wrap gap-x-5 gap-y-5 ${isMD || isLG || isXL || is2XL ? "grid-cols-3" : "grid-cols-1"}`}>

              <div key={leader.employeeId} className="bg-white">
                <ProfileWithDesignation
                  IsSmall={index !== 0}
                  Designation={getDesignationWithoutDepartment(leader.employeeDesignation)}
                  EmployeeName={leader.employeeName}
                  borderColor="border-[#1B7BFF]"
                  profile={leader.employeePic}
                  onRemoveAsTL={() => handleRemoveAsTeamLeader(leader.employeeId)}
                  isTeamLeader={true}
                />
              </div>
              </div>

            ))
          ) : (
            <div className="flex items-center gap-3 py-4 px-5 bg-blue-50/40 border-l-4 border-blue-400 rounded-r-xl mt-4">
  <div className="text-blue-500">
     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  </div>
  <span className="text-slate-600 text-[14px]">
    There are currently <strong>no team leaders</strong> registered in {selectedDepartment}.
  </span>
</div>
          )}
        </div>


      {/* Employees */}
      <div className="w-full space-y-5 flex items-start flex-col ">
       <div className="flex items-center gap-3 mt-7">
  <div className="w-1.5 h-8 bg-blue-600 rounded-full" /> 
  <h2 className={`${isXS || isSM ? "text-[16px]" : "text-[20px]"} font-bold text-slate-800 tracking-tight uppercase`}>
    Employees <span className="text-slate-400 font-medium ml-1">/ {selectedDepartment}</span>
  </h2>
</div>

        <div className={`flex flex-wrap gap-x-10 gap-y-5`}>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <div
                key={employee.employeeId}
                className={`flex ${isXS || isSM || isMD ? "w-[80px]" : "w-[100px]"} items-center flex-col relative`}
              >
                <div className={`${employee.employeePic ? "p-1" : "p-4"} relative z-10 rounded-full w-fit bg-white border-2 border-gray-400`}>
                  {employee.employeePic ? (
                    <img
                      src={`${serverURL}/files/${employee.employeePic}`}
                      style={{
                        width: isXS ? 30 :
                               isSM ? 40 :
                               isMD ? 50 :
                               isLG ? 60 :
                               isXL ? 70 :
                               is2XL ? 50 : 25,
                        height: isXS ? 30 :
                                isSM ? 40 :
                                isMD ? 50 :
                                isLG ? 60 :
                                isXL ? 70 :
                                is2XL ? 50 : 25,
                        borderRadius: "50%",
                        objectFit: "cover"
                      }}
                      alt="Employee"
                    />
                  ) : (
                    <FaUser
                      size={
                        isXS ? 25 :
                        isSM ? 30 :
                        isMD ? 35 :
                        isLG ? 40 :
                        isXL ? 45 :
                        is2XL ? 50 : 20
                      }
                      color="#9e9e9e"
                    />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-[12px]">{employee.employeeName}</div>
                  <div className="font-medium text-[12px]">Profile</div>
                </div>
                {/* Three-dot menu for Employee */}
                <div className="absolute top-0 right-0 z-20">
                  <FaEllipsisV
                    size={14}
                    className="text-gray-500 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmployeeMenu(showEmployeeMenu === employee.employeeId ? null : employee.employeeId);
                    }}
                  />
                </div>
                {/* Dropdown menu for Employee */}
                {showEmployeeMenu === employee.employeeId && (
                  <div className="employee-menu absolute top-7 -right-20 bg-white border border-gray-300 rounded-md  z-50 min-w-[150px]">
                    <div
                      onClick={() => {
                        setSelectedEmployeeForPromote(employee);
                        setShowEmployeeMenu(null);
                        setShowPromotePopup(true);
                      }}
                      className="block cursor-pointer w-full text-left px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
                    >
                      Promote to Team Leader
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
           <div className="flex items-center gap-3 py-4 px-5 bg-blue-50/40 border-l-4 border-blue-400 rounded-r-xl mt-4">
  <div className="text-blue-500">
     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  </div>
  <span className="text-slate-600 text-[14px]">
    There are currently <strong>no employee</strong> registered in {selectedDepartment}.
  </span>
</div>
          )}
        </div>
      </div>

      {/* Glassy Minimalistic Popup for Promoting Employee to Team Leader */}
      {showPromotePopup && selectedEmployeeForPromote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-white/20 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Promote to Team Leader</h3>
            <p className="mb-4 text-sm text-gray-600">Employee: {selectedEmployeeForPromote.employeeName}</p>
            <div className="mb-4">
  <label className="block text-sm font-medium text-gray-700">Security Key:</label>

  <div className="w-full mb-2 p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
    <div className="relative">
      <input
        type="text"
        value={securityKeyInput}
        onChange={(e) => setSecurityKeyInput(e.target.value)}
        placeholder="Enter security key"
        className="w-full px-4 py-1 pr-10 text-[12px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
        required
      />
      {/* Button inside input (right side) */}
      <div
        onClick={generateKey}
        className="absolute inset-y-0 right-2 flex rounded-full hover:scale-90 cursor-pointer bg-gray-200 p-1.5 items-center text-blue-600 hover:text-blue-800"
      >
        <FaBolt size={14} />
      </div>
    </div>
  </div>
</div>

            <div className="flex justify-end space-x-3">
              <div
                onClick={() => {
                  setShowPromotePopup(false);
                  setSelectedEmployeeForPromote(null);
                  setSecurityKeyInput("");
                }}
className="
  w-full cursor-pointer 
  hover:scale-80 
  duration-300 
  bg-red-300 
  rounded-lg  
  py-1.5 
  text-sm 
  font-semibold 
  transition-transform
"              >
                Cancel
              </div>
              <div
                onClick={handlePromoteToTeamLeader}
                // disabled={!securityKeyInput.trim()}
className="
  w-full cursor-pointer 
  hover:scale-80 
  duration-300 
  bg-green-300 
  rounded-lg  
  py-1.5 
  text-sm 
  font-semibold 
  transition-transform
"              >
                Promote
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllEmployeeList;