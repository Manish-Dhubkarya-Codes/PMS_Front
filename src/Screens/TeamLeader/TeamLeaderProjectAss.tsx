import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Button1 from "../../UI_Components/Buttons/Button1";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import ProfileWithDesignation from "../../UI_Components/Profile/ProfileWithDesignation";
import Button2 from "../../UI_Components/Buttons/Button2";
import EmployeeSearchBar from "../../UI_Components/SearchBars/EmployeeSearch";
import { postData, getData, serverURL } from "../../BackendConnections/FetchBackendServices";
import { Commet } from "react-loading-indicators";

interface Employee {
  name: string;
  pic: string | null;
  id: string;
  request_id: number;
  status: string;
}

interface AllEmployee {
  employeeId: string;
  employeeName: string;
  employeeDesignation: string;
  employeeMail: string;
  employmentID: string;
  employeePic: string | null;
  role: string;
}

interface GroupedRequestProps {
  request_id: number;
  project_id: string;
  employeeid: string;
  workstream: string;
  title: string;
  clientName: string;
  deadline: string;
  description: string | string[];
  status: string;
  created_at: string;
  employeeName: string;
  employeeDesignation: string;
  employeePic: string | null;
  employees?: Employee[];
}

const TeamLeaderProjectAss: React.FC = () => {
  const location = useLocation();
  const { selectedRequest } = location.state || { selectedRequest: null };
  const [width, setWidth] = useState(window.innerWidth);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeStatuses, setEmployeeStatuses] = useState<{ [key: string]: string }>({});
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<AllEmployee[]>([]);
  const [selectedDesignation, setSelectedDesignation] = useState<string>("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [errorRequests, setErrorRequests] = useState<string | null>(null);

  const projectInfo: GroupedRequestProps = selectedRequest || {
    workstream: "N/A",
    title: "N/A",
    project_id: "N/A",
    deadline: "N/A",
    description: "No description available",
    clientName: "N/A",
    employees: [],
    request_id: 0,
    employeeid: "0",
    status: "N/A",
    created_at: "N/A",
    employeeName: "N/A",
    employeeDesignation: "N/A",
    employeePic: null,
  };

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchProjectRequests = async () => {
      if (projectInfo.project_id && projectInfo.project_id !== "N/A") {
        setIsLoadingRequests(true);
        setErrorRequests(null);
        try {
          const response = await getData(`clientproject/project_employee_requests/${projectInfo.project_id}`);
          console.log("Fetched project requests:", response);
          if (response.status) {
            setEmployeesList(response.data);
            const statuses: { [key: string]: string } = {};
            response.data.forEach((emp: Employee) => {
              statuses[emp.id] = emp.status;
              console.log(`Employee ${emp.id} status: ${emp.status}`); // Debug status
            });
            setEmployeeStatuses(statuses);
          } else {
            setErrorRequests(response.message || "Failed to fetch project requests");
          }
        } catch (error) {
          console.error("Error fetching project requests:", error);
          setErrorRequests("Error fetching project requests. Please try again.");
        } finally {
          setIsLoadingRequests(false);
        }
      }
    };
    fetchProjectRequests();
  }, [projectInfo.project_id]);

  useEffect(() => {
    const fetchAllEmployees = async () => {
      if (projectInfo.project_id && projectInfo.project_id !== "N/A") {
        try {
          const response = await getData(`employees/fetch_all_employees?project_id=${projectInfo.project_id}`);
          console.log("Fetched all employees:", response);
          if (response.status) {
            setAllEmployees(response.data);
          } else {
            console.error("Failed to fetch all employees:", response.message);
          }
        } catch (error) {
          console.error("Error fetching all employees:", error);
        }
      }
    };
    fetchAllEmployees();
  }, [projectInfo.project_id]);

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;

  const employees = employeesList.map((emp) => ({
    EmployeeName: emp.name || "Unknown",
    EmployeeProfile: emp.pic,
    isSmall: true,
    employeeId: emp.id,
    requestId: emp.request_id,
    status: employeeStatuses[emp.id] || emp.status,
  }));

  console.log("Mapped employees with statuses:", employees);

  const handleAssign = async (requestId: number, employeeId: string, projectId: string) => {
    console.log("handleAssign called with:", { requestId, employeeId, projectId });
    if (!employeeId || !projectId || employeeId.trim() === "") {
      console.error("Invalid assignment data:", { requestId, employeeId, projectId });
      return;
    }

    try {
      const response = await postData("clientproject/update_request_status", {
        request_id: requestId,
        employeeId: employeeId,
        project_id: projectId,
      });
      console.log("Assign API Response:", response);
      if (response.status) {
        setEmployeesList(prev =>
          prev.map(emp =>
            emp.id === employeeId ? { ...emp, status: 'accepted' } : emp
          )
        );
        setEmployeeStatuses(prev => ({
          ...prev,
          [employeeId]: 'accepted',
        }));
      } else {
        console.error("Assign failed:", response.message);
      }
    } catch (error) {
      console.error("Error assigning employee:", error);
    }
  };

  const handleDecline = async (requestId: number, employeeId: string, projectId: string) => {
    console.log("handleDecline called with:", { requestId, employeeId, projectId });
    if (!employeeId || !projectId || employeeId.trim() === "") {
      console.error("Invalid decline data:", { requestId, employeeId, projectId });
      return;
    }

    try {
      const response = await postData("clientproject/decline_request_status", {
        request_id: requestId,
        employeeId: employeeId,
        project_id: projectId,
      });
      console.log("Decline API Response:", response);
      if (response.status) {
        setEmployeesList(prev =>
          prev.map(emp =>
            emp.id === employeeId ? { ...emp, status: 'decline' } : emp
          )
        );
        setEmployeeStatuses(prev => ({
          ...prev,
          [employeeId]: 'decline',
        }));
      } else {
        console.error("Decline failed:", response.message);
      }
    } catch (error) {
      console.error("Error declining employee:", error);
    }
  };

  const handleCheckboxChange = (employeeId: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleAssignSelected = async () => {
    if (selectedEmployeeIds.length === 0) {
      console.error("No employees selected for assignment");
      return;
    }

    try {
      for (const employeeId of selectedEmployeeIds) {
        const response = await postData("clientproject/submit_request", {
          project_id: projectInfo.project_id,
          employeeId: employeeId,
          status: "TLAssign",
        });
        console.log("Submit request response:", response);
        if (response.status) {
          setEmployeesList(prev => [
            ...prev,
            {
              id: employeeId,
              name: allEmployees.find(emp => emp.employeeId === employeeId)?.employeeName || "Unknown",
              pic: allEmployees.find(emp => emp.employeeId === employeeId)?.employeePic || null,
              request_id: response.data.request_id,
              status: "TLAssign",
            },
          ]);
          setEmployeeStatuses(prev => ({
            ...prev,
            [employeeId]: "TLAssign",
          }));
          // Remove assigned employee from allEmployees to update the Self Assign list
          setAllEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
        }
      }
      setSelectedEmployeeIds([]); // Clear selections after submission
    } catch (error) {
      console.error("Error assigning selected employees:", error);
    }
  };

  const getDisplayStatus = (status: string) => {
    console.log("getDisplayStatus called with:", status); // Debug status mapping
    switch (status) {
      case "TLAssign":
        return "Assigned By TL";
      case "accepted":
        return "Assigned";
      case "pending":
        return "Pending";
      case "decline":
        return "Declined";
      default:
        return status;
    }
  };

  const descriptionContent =
    Array.isArray(projectInfo.description)
      ? projectInfo.description.join("")
      : projectInfo.description;

  const uniqueDesignations = [...new Set(allEmployees.map(emp => emp.employeeDesignation))];

  const filteredAllEmployees = allEmployees.filter(emp => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      emp.employeeName.toLowerCase().includes(query) ||
      emp.employmentID.toLowerCase().includes(query) ||
      emp.employeeDesignation.toLowerCase().includes(query);
    const matchesDesignation = selectedDesignation ? emp.employeeDesignation === selectedDesignation : true;
    return matchesSearch && matchesDesignation;
  });

  return (
    <div className="w-full">
      <MainNavigation isMenuHide={false} />
      <div
        className={`flex flex-col text-[12px] text-start w-full -tracking-[0.02rem] text-black ${
          isLG
            ? "px-[7.5vw] pt-20 overflow-y-auto justify-center"
            : isXL || is2XL
            ? "px-[10.5vw] overflow-y-auto pt-[11vh] justify-center"
            : "px-[4vw] pt-15"
        } items-start space-y-6`}
      >
        <div
          className={`w-full ${
            isXXS || isXS || isSM ? "space-y-4" : "flex"
          } justify-between`}
        >
          <Button1 value={projectInfo.workstream} gradientType="gradient1" />
          <div>Submission Date: {new Date(projectInfo.deadline).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })}</div>
        </div>
        <div className="flex gap-x-1">
          <div>Project ID:</div>
          <div className="font-semibold">{projectInfo.project_id}</div>
        </div>
        <div style={{ whiteSpace: "pre" }}>
          Title: {" " + projectInfo.title}
        </div>
        <div>Client Name: {projectInfo.clientName}</div>
        <div dangerouslySetInnerHTML={{ __html: descriptionContent }} />
        <div className="space-y-4">
          <div>Deadline: {projectInfo.deadline}</div>
        </div>
      </div>
      <div className="w-full pb-[5vh] pt-[5vh] flex flex-col items-start">
        <div className="w-full border-1 border-[#000]"></div>
        <div
          className={`text-black ${
            isXXS || isXS || isSM
              ? "text-[16px]"
              : isMD
              ? "text-[17px]"
              : isLG
              ? "text-[20px]"
              : is2XL || isXL
              ? "text-[20px]"
              : ""
          } ${
            isLG ? "px-[7.5vw]" : isXL || is2XL ? "px-[10.5vw]" : "px-[4vw]"
          } pt-[2vh] font-medium -tracking-[0.02rem]`}
        >
          Requests
        </div>
        {isLoadingRequests ? (
          <div
            className={`${
              isLG ? "px-[7.5vw]" : isXL || is2XL ? "px-[10.5vw]" : "px-[4vw]"
            } pt-[2vh] text-gray-500`}
          >
            <Commet color="#32cd32" size="medium" text="Loading requests..." textColor="#000" />
          </div>
        ) : errorRequests ? (
          <div
            className={`${
              isLG ? "px-[7.5vw]" : isXL || is2XL ? "px-[10.5vw]" : "px-[4vw]"
            } pt-[2vh] text-red-600`}
          >
            {errorRequests}
          </div>
        ) : employees.length === 0 ? (
          <div
            className={`${
              isLG ? "px-[7.5vw]" : isXL || is2XL ? "px-[10.5vw]" : "px-[4vw]"
            } pt-[2vh] text-gray-500`}
          >
            No requests found
          </div>
        ) : (
          <div
            className={`${
              isXXS || isXS || isSM || isMD || isLG
                ? "flex flex-col"
                : "flex flex-row space-x-4"
            } w-full ${
              isLG ? "px-[7.5vw]" : isXL || is2XL ? "px-[10.5vw]" : "px-[4vw]"
            } pt-[2vh]`}
          >
            <div
              className={`${
                isXXS || isXS || isSM || isMD || isLG ? "w-full" : "w-[70%]"
              } space-y-5 pt-2`}
            >
              <div className="block md:hidden pb-2 overflow-x-auto">
                <div className="flex gap-5 w-max items-end">
                  {employees.map((leader, index) => (
                    <div key={index} className="min-w-[250px] flex-shrink-0 relative">
                      <ProfileWithDesignation
                        IsSmall={leader.isSmall}
                        Status={getDisplayStatus(leader.status)}
                        EmployeeName={leader.EmployeeName}
                        profile={leader.EmployeeProfile}
                        onAssign={() => handleAssign(leader.requestId, leader.employeeId, projectInfo.project_id)}
                        onDecline={() => handleDecline(leader.requestId, leader.employeeId, projectInfo.project_id)}
                        isPending={leader.status === "pending"}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div
                className={`hidden md:grid items-end custom-indent-wrap gap-x-5 gap-y-5 ${
                  isMD || isLG
                    ? "grid-cols-3"
                    : isXL || is2XL
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {employees.map((leader, index) => (
                  <div key={index} className="bg-white">
                    <ProfileWithDesignation
                      IsSmall={leader.isSmall}
                      Status={getDisplayStatus(leader.status)}
                      EmployeeName={leader.EmployeeName}
                      profile={leader.EmployeeProfile}
                      onAssign={() => handleAssign(leader.requestId, leader.employeeId, projectInfo.project_id)}
                      onDecline={() => handleDecline(leader.requestId, leader.employeeId, projectInfo.project_id)}
                      isPending={leader.status === "pending"}
                    />
                  </div>
                ))}
              </div>
            </div>
            {(is2XL || isXL) && <div className="h-[350px] w-[1px] border-1"></div>}
            <div
              className={`flex flex-col space-y-6 ${
                is2XL || isXL ? "pl-6 w-[35%]" : "mt-4"
              } items-start`}
            >
              <div
                className={`text-black ${
                  isXXS || isXS || isSM
                    ? "text-[14px]"
                    : isMD
                    ? "text-[14px]"
                    : isLG
                    ? "text-[14px]"
                    : is2XL || isXL
                    ? "text-[16px]"
                    : ""
                } pt-[2vh] font-medium -tracking-[0.02rem]`}
              >
                Self Assign
              </div>
              <div className="w-full">
                <EmployeeSearchBar value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <select
                value={selectedDesignation}
                onChange={(e) => setSelectedDesignation(e.target.value)}
                className="w-full h-[34px] text-black bg-white border-[1.5px] border-blue-400 rounded-[5px] py-1 px-4 text-[14px] font-medium focus:outline-none focus:border-[#1B7BFF]"
              >
                <option value="">All Designations</option>
                {uniqueDesignations.map((des) => (
                  <option key={des} value={des}>
                    {des}
                  </option>
                ))}
              </select>
              <div className="w-full">
                {filteredAllEmployees.length > 0 ? (
  <div className="w-full text-black bg-white border border-slate-200 rounded-lg max-h-[220px] overflow-y-auto thin-scroll shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 transition-all">
    <ul className="divide-y divide-slate-200">
      {filteredAllEmployees.map((emp) => {
        const isSelected = selectedEmployeeIds.includes(emp.employeeId);
        // Create initials for the avatar
        const initials = emp.employeeName
          .split(' ')
          .map(n => n[0])
          .slice(0, 2)
          .join('');

        return (
          <li
            // Change: Use a unique and stable ID for the key, not the index.
            key={emp.employeeId}
            onClick={() => handleCheckboxChange(emp.employeeId)}
            className={`flex items-center justify-between p-3 cursor-pointer transition-colors duration-150 relative ${
              isSelected
                ? "bg-blue-50"
                : "hover:bg-slate-50"
            }`}
          >
            {/* Change: Added a colored bar for a clearer selected state */}
            {isSelected && (
              <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-l-md"></div>
            )}
            
            <div className="flex items-center space-x-4">
              {!emp.employeePic?
              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-slate-200 rounded-full font-bold text-slate-500">
                {initials}
              </div>:
             <div className="flex items-center justify-center">
  <img
    src={`${serverURL}/files/${emp.employeePic}`}
    alt={emp.employeeName}
    className="h-10 w-10 rounded-full object-cover border border-gray-200 shadow-sm"
  />
</div>
      }

              {/* Change: Improved text hierarchy */}
              <div className="text-start">
                <p className="font-semibold text-slate-800">{emp.employeeName}</p>
                <p className="text-sm text-slate-500">{emp.employeeDesignation}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-500 font-mono hidden sm:block">ID: {emp.employmentID}</span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}} // Still handled by row click
                readOnly // Use readOnly for better accessibility with row click
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </li>
        );
      })}
    </ul>
  </div>
) : (
  <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-lg">
    <p className="font-medium">No Employees Found</p>
  </div>
)}

              </div>
              <Button2 value="Assign to Selected" onClick={handleAssignSelected} disabled={selectedEmployeeIds.length === 0} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamLeaderProjectAss;