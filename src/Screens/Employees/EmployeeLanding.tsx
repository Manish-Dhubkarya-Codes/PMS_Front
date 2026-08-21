import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import MainSearchBar from "../../UI_Components/SearchBars/MainSearchBar";
import Navigation1 from "../../UI_Components/Navigations/Navigation1";
import Filter from "../../UI_Components/Filter/Filter";
import Button1 from "../../UI_Components/Buttons/Button1";
import PaginationNav from "../../UI_Components/Navigations/PaginationNav";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import { TbFilterBolt } from "react-icons/tb";
import EmployeeProfile from "./EmployeeProfile";
import { AuthContext } from "../Authentication/AuthContext";
import { useNavigate } from "react-router-dom";
import { getData, postData } from "../../BackendConnections/FetchBackendServices";
import PageLoadingComponent from "../../UI_Components/Pop_Ups/PageLoadingComponent";
import { useSocket } from "../../BackendConnections/useSocket";
import { MdDoNotTouch } from "react-icons/md";
import { isQuietProjectStatus } from "../../utils/chatLive";
import { readStoredRole, readStoredUserData } from "../../utils/authStorage";
import ActiveSinceLabel from "../../UI_Components/ActiveSinceLabel";

interface ProjectDetailsProps {
  workstream: string;
  title: string;
  clientName: string;
  project_id: string;
  deadline: string;
  description: string | string[];
  status: string;
  active_date?: string | null;
}

interface ProjectRequestProps {
  request_id: number;
  project_id: string;
  employeeid: number;
  status: string;
  created_at: string;
  workstream: string;
  title: string;
  deadline: string;
  description: string | string[];
  clientName: string;
  active_date?: string | null;
  project_status?: string | null;
}

interface AllRequestProps {
  request_id: number;
  project_id: string;
  employeeid: number;
  status: string;
  // Add other fields if needed
}

const EmployeeLanding: React.FC = () => {
  const tabs = ["Active", "Accepted", "Requested", "Completed"];
  const filters = [
    "Data Science",
    "AI",
    "Plagarism Removal",
    "Thesis",
    "Software Development",
  ];
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<{
    EmployeeName: string;
    Profile: string;
    Designation: string;
    employeeId?: number;
  } | null>(null);
  const [projectDetails, setProjectDetails] = useState<ProjectDetailsProps[]>([]);
  const [employeeRequests, setEmployeeRequests] = useState<ProjectRequestProps[]>([]);
  const [allEmployeeRequests, setAllEmployeeRequests] = useState<AllRequestProps[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [renderDrawer, setRenderDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
    const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
    const [newAcceptedCount, setNewAcceptedCount] = useState(0);
  const [activeTab, setActiveTab] = useState(() => {
  return localStorage.getItem("employeeLandingActiveTab") || tabs[0];
});
  const [unreadRequests, setUnreadRequests] = useState<{ [project_id: string]: { unreadFromTL: number; tlName: string } }>({});
  const itemsPerPage = 6;

  // Socket integration
  const { emitEvent, onEvent, connected } = useSocket();

  // NEW: Reusable fetch functions for live updates
  const fetchProjectData = useCallback(async () => {
    try {
      const response = await getData("clientproject/show_all_clientsprojects");
      if (response.status && Array.isArray(response.data)) {
        const filteredProjects = response.data.filter((project: ProjectDetailsProps) => project.status !== "Hold");
        setProjectDetails(filteredProjects);
        setError(null);                    // ← clear error
      } else {
        setError("Invalid project data received");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch projects. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEmployeeRequests = useCallback(async () => {
    if (!employeeData?.employeeId) {
      setRequestsLoading(false);
      return;
    }
    try {
      const response = await getData(`clientproject/project_request_status/${employeeData.employeeId}`);
      if (response.status && Array.isArray(response.data)) {
        setEmployeeRequests(response.data);
        setError(null);                    // ← clear error
      } else {
        setError("Invalid request data received");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch requests. Please try again.");
    } finally {
      setRequestsLoading(false);
    }
  }, [employeeData?.employeeId]);

  // Access AuthContext
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error("EmployeeProfile must be used within an AuthProvider");
  }
  const { logout: contextLogout } = authContext;

  // Fetch all employee requests
  useEffect(() => {
    const fetchAllRequests = async () => {
      try {
        const response = await getData("clientproject/employee_requests");
        if (response.status && Array.isArray(response.data)) {
          setAllEmployeeRequests(response.data);
        } else {
          setAllEmployeeRequests([]);
        }
      } catch (err) {
        setAllEmployeeRequests([]);
      }
    };

    fetchAllRequests();
  }, []);

  // Fetch unread TL messages for requested projects
  const requestedProjectIds = useMemo(() => {
    return [...new Set(employeeRequests.map(req => req.project_id))];
  }, [employeeRequests]);

  const fetchUnreadForRequests = useCallback(async () => {
    if (!employeeRequests.length || !employeeData?.employeeId) return;

    const unreadPromises = requestedProjectIds.map(async (projectId) => {
      try {
        const tlMonitorResponse = await getData(`clientproject/get_tl_monitor_chats/${projectId}`);
        
        let unreadFromTL = 0;
        let tlName = "Team Leader";

        if (tlMonitorResponse.status && tlMonitorResponse.data) {
          const tlChatsMonitor = tlMonitorResponse.data.tlchats || [];
          const tlAudiosMonitor = tlMonitorResponse.data.tlaudios || [];
          [...tlChatsMonitor, ...tlAudiosMonitor].forEach((chat: string) => {
            try {
              const parsed = JSON.parse(chat);
              if (!parsed.seen_by || !parsed.seen_by.includes("monitor")) {
                unreadFromTL++;
              }
            } catch {
              // Ignore parsing errors
            }
          });
          tlName = tlMonitorResponse.data.teamleadername || "Team Leader";
        }

        return { 
          project_id: projectId, 
          unreadFromTL, 
          tlName 
        };
      } catch (err) {
        return { 
          project_id: projectId, 
          unreadFromTL: 0, 
          tlName: "Team Leader" 
        };
      }
    });

    const unreadResults = await Promise.all(unreadPromises);
    const unreadMap = unreadResults.reduce((acc: { [key: string]: { unreadFromTL: number; tlName: string } }, result) => {
      acc[result.project_id] = { 
        unreadFromTL: result.unreadFromTL, 
        tlName: result.tlName 
      };
      return acc;
    }, {});
    setUnreadRequests(unreadMap);

  }, [employeeRequests, employeeData, allEmployeeRequests, requestedProjectIds]);

  // Join employee room (global + personal so request updates arrive live)
  useEffect(() => {
    if (connected) {
      emitEvent("joinEmployeeRoom", employeeData?.employeeId || null);
    }
  }, [connected, emitEvent, employeeData?.employeeId]);

  useEffect(() => {
  if (employeeRequests.length > 0) {
    fetchUnreadForRequests();
  }
}, [employeeRequests.length]); // runs only when the list first becomes non-empty

// ========== LIVE UNREAD COUNT VIA SOCKET (NO API CALL) ==========
useEffect(() => {
  if (!connected) return;

  const handleNewTlMessage = (data: {
    fromRole: string;
    msg: any;
    projectId?: string;
  }) => {
    if (data.fromRole !== "tl" || !data.projectId) return;

    // Already seen by this employee → ignore
    if (
      data.msg?.seen_by?.includes("monitor") ||
      data.msg?.seen_by?.includes("employee")
    ) {
      return;
    }

    setUnreadRequests(prev => {
      const current = prev[data.projectId!] || {
        unreadFromTL: 0,
        tlName: "Team Leader",
      };
      return {
        ...prev,
        [data.projectId!]: {
          ...current,
          unreadFromTL: current.unreadFromTL + 1,
        },
      };
    });
  };

const handleSeen = (data: { projectId?: string; seen_by?: string[] }) => {
  if (!data.projectId) return;

  // When messages are marked as seen by the employee, clear unread count for that project
  setUnreadRequests((prev) => {
    const current = prev[data.projectId!];
    if (!current) return prev;

    return {
      ...prev,
      [data.projectId!]: {
        ...current,
        unreadFromTL: 0,          // clear the count
      },
    };
  });
};

  const offNew = onEvent("newTLMonitorMessage", handleNewTlMessage);
  const offSeen = onEvent("tlMonitorMessageSeen", handleSeen);

  return () => {
    offNew?.();
    offSeen?.();
  };
}, [connected, onEvent]);

  // Join shared chat rooms for all projects the employee is involved in
useEffect(() => {
  if (!connected || !employeeData?.employeeId) return;

  const projectIds = [
    ...new Set(
      employeeRequests
        .filter(r => ["accepted", "TLAssign", "pending"].includes(r.status))
        .map(r => r.project_id)
    )
  ];

  projectIds.forEach(projectId => {
    emitEvent("joinEmployeeChat", projectId);   // ← only this, no API call
  });
}, [connected, employeeData?.employeeId, employeeRequests, emitEvent]);

  // Fetch employee data from localStorage
  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        const parsedUserData = readStoredUserData();
        const role = readStoredRole();

        if (!parsedUserData || !role) {
          throw new Error("No user data or role found in localStorage");
        }

        if (role !== "Employee") {
          throw new Error("Invalid role in localStorage");
        }

        if (!parsedUserData.employeeName || !parsedUserData.employeeDesignation || !parsedUserData.employeeId) {
          throw new Error("Missing required employee data");
        }

        setEmployeeData({
          EmployeeName: parsedUserData.employeeName,
          Profile: parsedUserData.employeePic || "",
          Designation: parsedUserData.employeeDesignation,
          employeeId: parsedUserData.employeeId,
        });
      } catch (error) {
        setEmployeeData({
          EmployeeName: "Unknown Employee",
          Profile: "",
          Designation: "N/A",
        });
      }
    };

    fetchEmployeeData();
  }, []);

    // Fetch projects (used for Active + Completed tabs)
  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);


  // Fetch employee requests and unread TL messages
    // Fetch employee requests (used for Requested + Accepted tabs)
  useEffect(() => {
    fetchEmployeeRequests();
  }, [fetchEmployeeRequests]);

// === LIVE SOCKET UPDATES FOR ALL TABS ===
useEffect(() => {
  if (!connected) return;

  // When a new project is created (or activated)
  const handleNewProject = () => {
    console.log("🆕 New project received – refreshing Active list");
    fetchProjectData();               // full refresh so Active tab updates correctly
  };

  // When project status changes (Hold → Active, Active → Completed, etc.)
  const handleProjectStatusUpdated = (data: {
    project_id?: string | number;
    projectId?: string | number;
    status: string;
    active_date?: string | null;
  }) => {
    const id = String(data.project_id ?? data.projectId ?? "");
    console.log("🔄 Project status updated", data);
    if (!id) {
      fetchProjectData();
      return;
    }
    setProjectDetails((prev) => {
      const exists = prev.some((project) => String(project.project_id) === id);
      if (!exists) {
        fetchProjectData();
        return prev;
      }
      return prev.map((project) =>
        String(project.project_id) === id
          ? { ...project, status: data.status, active_date: data.active_date ?? project.active_date }
          : project
      );
    });
    setEmployeeRequests((prev) =>
      prev.map((request) =>
        String(request.project_id) === id
          ? {
              ...request,
              project_status: data.status,
              active_date: data.active_date ?? request.active_date,
            }
          : request
      )
    );
  };

  const handleNewEmployeeRequest = (newRequest: any) => {
    const requestEmployeeId = newRequest.employeeid ?? newRequest.employeeId;
    if (employeeData?.employeeId && String(requestEmployeeId) === String(employeeData.employeeId)) {
      setEmployeeRequests((prev) => {
        if (prev.some((r) => r.request_id === newRequest.request_id)) return prev;
        return [...prev, newRequest];
      });
    }
  };

  const handleEmployeeRequestsSnapshot = (payload: { data?: ProjectRequestProps[] }) => {
    if (Array.isArray(payload?.data)) {
      setEmployeeRequests(payload.data);
    } else {
      fetchEmployeeRequests();
    }
  };

const handleRequestStatusUpdate = (data: { request_id: number; status: string }) => {
  setEmployeeRequests((prev) =>
    prev.map((req) => (req.request_id === data.request_id ? { ...req, status: data.status } : req))
  );
  setAllEmployeeRequests((prev) =>
    prev.map((req) => (req.request_id === data.request_id ? { ...req, status: data.status } : req))
  );

  // Show notification on Accepted tab when a request is accepted
  if (data.status === "accepted") {
    setNewAcceptedCount((prev) => prev + 1);

    setTimeout(() => {
      fetchUnreadForRequests();
    }, 300);
  }
};

  const offs = [
    onEvent("newProjectCreated", handleNewProject),
    onEvent("newProjectActivated", handleNewProject),
    onEvent("projectStatusUpdated", handleProjectStatusUpdated),
    onEvent("projectStatusUpdate", handleProjectStatusUpdated),
    onEvent("newEmployeeRequest", handleNewEmployeeRequest),
    onEvent("employeeRequestStatusUpdate", handleRequestStatusUpdate),
    onEvent("employeeRequestsUpdate", handleEmployeeRequestsSnapshot),
  ];

  return () => {
    offs.forEach((off) => off?.());
  };
}, [connected, onEvent, employeeData?.employeeId, fetchProjectData, fetchEmployeeRequests, fetchUnreadForRequests]);

    // 🔥 FORCE LIVE UPDATE FOR UNREAD COUNT BADGE ON ACCEPTED TAB
// Only fetch once when the user opens Accepted or Requested tab
useEffect(() => {
  if (activeTab === "Accepted" || activeTab === "Requested") {
    fetchUnreadForRequests();
  }

  // Clear "new accepted" badge when user opens Accepted tab
  if (activeTab === "Accepted") {
    setNewAcceptedCount(0);
  }
}, [activeTab]);

useEffect(() => {
  const checkRole = async () => {
    const storedUserDataB64 = localStorage.getItem("userData");
    const storedRoleB64 = localStorage.getItem("role");

    if (!storedUserDataB64 || !storedRoleB64) {
      console.warn("No user data or role found. Logging out...");
      if (contextLogout) contextLogout();
      window.location.href = "/login-reg";   // ← Hard redirect
      return;
    }

    try {
      const storedUserData = JSON.parse(atob(storedUserDataB64));
      const role = atob(storedRoleB64);

      const { employeeId } = storedUserData;
      if (!employeeId || !role) {
        if (contextLogout) contextLogout();
        window.location.href = "/login-reg";
        return;
      }

      const response = await postData("employees/verify_employee_role", {
        employeeId: parseInt(employeeId),
        role
      });

      if (!response.status) {
        if (contextLogout) contextLogout();
        window.location.href = "/login-reg";
      } else {
        console.log("Role verified successfully.");
      }
    } catch (error) {
      console.error("Error verifying role:", error);
      if (contextLogout) contextLogout();
      window.location.href = "/login-reg";
    }
  };

  checkRole();
}, []); // ← Empty dependency array (important)

  const employeeProfile = {
    EmployeeName: employeeData?.EmployeeName ?? "Unknown Employee",
    Profile: employeeData?.Profile ?? "",
    Designation: employeeData?.Designation ?? "N/A",
    TL: "Dheer Verma",
    ProjectStartDate: "1 June",
    ProjectEndDate: "1 Sep",
    ProjectOnGoing: 10,
    ProjectCompleted: 20,
    Performance: [
      { label: "Accuracy", value: "90%" },
      { label: "On Time Execution", value: "70%" },
      { label: "Skills", value: "80%" },
      { label: "Efficiency", value: "75%" },
    ],
  };

  // Calculate separate unread totals for each tab
  const acceptedProjects = useMemo(() => 
    employeeRequests
      .filter(r => r.status === "accepted")
      .map(r => r.project_id),
    [employeeRequests]
  );

  const requestedProjects = useMemo(() => 
    employeeRequests
      .filter(r => r.status !== "accepted")
      .map(r => r.project_id),
    [employeeRequests]
  );

const projectStatusMap = useMemo(() => 
  projectDetails.reduce((acc: { [key: string]: string }, proj) => {
    acc[proj.project_id] = proj.status;
    return acc;
  }, {}),
  [projectDetails]
);

// Update the acceptedUnreadTotal useMemo
// Badge on Accepted tab = newly accepted requests + unread messages
const acceptedUnreadTotal = useMemo(() => {
  const unreadMsgCount = acceptedProjects.reduce((sum, pid) => {
    const status = projectStatusMap[pid];
    if (!isQuietProjectStatus(status)) {
      return sum + (unreadRequests[pid]?.unreadFromTL || 0);
    }
    return sum;
  }, 0);

  return unreadMsgCount + newAcceptedCount;
}, [acceptedProjects, unreadRequests, projectStatusMap, newAcceptedCount]);

const requestedUnreadTotal = useMemo(() => 
  requestedProjects.reduce((sum, pid) => {
    const status = projectStatusMap[pid];
    if (!isQuietProjectStatus(status)) {
      return sum + (unreadRequests[pid]?.unreadFromTL || 0);
    }
    return sum;
  }, 0),
  [requestedProjects, unreadRequests, projectStatusMap]
);

// Active tab has no TL-monitor chat yet → always 0
const activeUnreadTotal = 0;

  // NEW: Live data for all tabs (Active, Requested, Accepted, Completed)
  const data = useMemo(() => {
    const withProjectDates = <T extends { project_id: string; active_date?: string | null; status?: string; project_status?: string | null }>(
      items: T[]
    ) =>
      items.map((item) => {
        const proj = projectDetails.find((p) => String(p.project_id) === String(item.project_id));
        return {
          ...item,
          active_date: item.active_date ?? proj?.active_date ?? null,
          project_status: item.project_status ?? proj?.status ?? item.status,
        };
      });

    if (activeTab === "Active") {
      const requestedProjectIds = new Set(employeeRequests.map((r) => String(r.project_id)));
      return withProjectDates(
        projectDetails.filter((project) =>
          !requestedProjectIds.has(String(project.project_id)) && project.status === "Active"
        )
      );
    }
    if (activeTab === "Requested") {
      return withProjectDates(employeeRequests.filter((item) => item.status !== "accepted"));
    }
    if (activeTab === "Accepted") {
      return withProjectDates(employeeRequests.filter((item) => item.status === "accepted"));
    }
    if (activeTab === "Completed") {
      return withProjectDates(projectDetails.filter((project) => project.status === "Completed"));
    }
    return [];
  }, [activeTab, projectDetails, employeeRequests]);

  const filteredItems = useMemo(() => {
    return data.filter((item) => {
      const descriptionStr = Array.isArray(item.description)
        ? item.description.join(" ")
        : typeof item.description === "string"
        ? item.description
        : "";
      return (
        (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ("clientName" in item && item.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          item.project_id.toString().includes(searchQuery) ||
          item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
          descriptionStr.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (selectedFilters.length === 0 ||
          selectedFilters.some((filter) =>
            item.workstream.toLowerCase().includes(filter.toLowerCase())
          ))
      );
    });
  }, [data, searchQuery, selectedFilters]);

 const totalPages = Math.max(
  1,
  Math.ceil(filteredItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  const maxTextLength = Math.max(
    ...(data.map((item) => item.title?.length || 0)),
    10
  );

  const widthClass =
    maxTextLength > 30
      ? "w-[300px]"
      : maxTextLength > 20
      ? "w-[250px]"
      : "w-[200px]";

  // Reset to first page when search query or activeTab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, selectedFilters]);

  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (showFilter) {
      setRenderDrawer(true);
      setTimeout(() => {
        setDrawerVisible(true);
      }, 10);
    } else {
      setDrawerVisible(false);
      const timeout = setTimeout(() => {
        setRenderDrawer(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [showFilter]);

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;

  if (isLoading || requestsLoading) {
    return <PageLoadingComponent />;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }
  return (
    <div
      className={`flex w-full text-black ${
        isXL || is2XL
          ? "flex-col min-h-screen py-[10vh] px-[10vw] items-center justify-start space-y-6"
          : isLG
          ? "flex-col min-h-screen py-[10vh] px-[5vw] items-center justify-start space-y-6"
          : "flex-col relative min-h-screen py-[10vh] px-[5vw] items-center justify-start space-y-6"
      }`}
    >
      <MainNavigation isMenuHide={false} />
      <div
        className={`flex ${
          isXXS || isXS || isSM || isMD
            ? "w-full justify-center items-center space-x-[10vw]"
            : "w-full items-center justify-center"
        }`}
      >
        {(isXXS || isXS || isSM || isMD) &&(activeTab!==tabs[4]) && (
          <div>
            <TbFilterBolt size={25} onClick={() => setShowFilter(true)} />
          </div>
        )}
        <div className={`${isXXS || isXS || isSM || isMD ? "w-fit" : "w-fit"}`}>
          <MainSearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </div>
      </div>
      <div className={`flex w-full gap-x-5 items-start shrink-0 flex-row`}>
        {isXXS || isXS || isSM || isMD || activeTab === tabs[4] ? (
          renderDrawer && (
            <div
              className={`
                fixed top-9 left-0 w-[280px] z-5 bg-blue-50 p-4 rounded-br-[10px]
                transform transition-transform duration-300 ease-in-out
                ${drawerVisible ? "translate-x-0" : "-translate-x-full"}
              `}
            >
              <Filter
                filters={filters}
                setClose={() => setShowFilter(false)}
                setSelectedFilters={setSelectedFilters}
              />
            </div>
          )
        ) : (
          <div className="w-[25%] mt-2">
            <Filter
              filters={filters}
              setClose={setShowFilter}
              setSelectedFilters={setSelectedFilters}
            />
          </div>
        )}
        <div
          className={`flex flex-col ${
            isXXS || isXS || isSM || isMD
              ? "w-full"
              : activeTab === tabs[4]
              ? "w-full flex"
              : "w-[75%]"
          }`}
        >
          <div
            className={`items-center flex ${
              isXXS || isXS || isSM || isMD
                ? "w-full"
                : activeTab === tabs[4]
                ? "w-full flex items-center"
                : "justify-start w-full"
            }`}
          >
            <div className={`w-full ${isXXS || isXS || isSM || isMD ? "" : "mr-[24%]"}`}>

<Navigation1
  tabs={tabs}
  activeTab={activeTab}
  setActiveTab={(tab) => {
    setActiveTab(tab);
    localStorage.setItem("employeeLandingActiveTab", tab);
  }}
  totalUnreadActive={activeUnreadTotal}
  totalUnreadAccepted={acceptedUnreadTotal}
  totalUnreadRequested={requestedUnreadTotal}
/>
            </div>
          </div>
          {activeTab !== tabs[4] ? (
            <div className="overflow-x-auto">
              {filteredItems.length > 0 ? (
                currentItems.map((item, index) => {
                  const projectItem = item as ProjectRequestProps;
                  const unreadInfoForProject = unreadRequests[projectItem.project_id] || { unreadFromTL: 0, tlName: "Team Leader" };
                  const isCompletedTab = activeTab === "Completed";
                  return (
                    <div
                      key={index}
                      className={`cursor-pointer flex justify-start items-start ${
                        index === currentItems.length - 1 ? "mt-7" : "my-7"
                      } w-full min-w-[700px] flex-col`}
onClick={() => {
  // Clear unread count for this project when opening it
  setUnreadRequests((prev) => {
    const current = prev[item.project_id];
    if (!current) return prev;
    return {
      ...prev,
      [item.project_id]: {
        ...current,
        unreadFromTL: 0,
      },
    };
  });

  // Clear the "new accepted" notification
  setNewAcceptedCount(0);

  // Also dismiss the green dot
  setDismissedNotifications((prev) => new Set([...prev, String(item.project_id)]));

  navigate(`/employeeprojectinfo`, { state: { item } });
}}
                    >
                      <div className="flex flex-col-reverse items-start justify-start w-full">
<div className="w-full flex items-start justify-between">
  <div className="flex flex-row items-center gap-2">
    <Button1
      width={widthClass}
      gradientType={isCompletedTab ? undefined : "gradient1"}
      text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
      value={item.workstream}
    />
    <div className="flex items-center gap-2 border-l-2 border-indigo-600 pl-2.5 py-0.5">
      <span className="font-mono text-[14px] font-bold text-slate-900 tracking-tight">
        {"ID:" + item.project_id}
      </span>
    </div>

    {/* GREEN DOT ONLY — never for Hold / Completed */}
    {unreadInfoForProject.unreadFromTL > 0 &&
      !isQuietProjectStatus(projectStatusMap[projectItem.project_id] || (projectItem as any).status) &&
      !dismissedNotifications.has(String(projectItem.project_id)) && (
        <span
          className="relative flex h-3 w-3 cursor-pointer ml-2"
          title="New message from Team Leader"
          onClick={(e) => {
            e.stopPropagation();
            setDismissedNotifications(
              (prev) => new Set([...prev, String(projectItem.project_id)])
            );
          }}
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      )}
  </div>
</div>
                        <div className="border-t-2 border-[#000000] w-full"></div>
                      </div>
                      <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
                        <div
                          className={`text-[#000000] w-[35%] text-start flex font-normal ${
                            is2XL ? "text-[15px]" : "text-[12px]"
                          } -tracking-[0.02rem]`}
                        >
                          {item.title}
                        </div>
                       <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] ${
    is2XL ? "text-[15px]" : "text-[12px]"
  } -tracking-[0.02rem]`}
>
  <div>
    Submission Date: {new Date(item.deadline).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })}
  </div>

  <ActiveSinceLabel
    activeDate={(item as any).active_date}
    status={(item as any).project_status || item.status}
  />
</div>
                       <div
  className={`${
    "status" in item
      ? item.status === "decline"
        ? "text-[#FF0000]"
        : item.status === "accepted"
        ? "text-[#0FB300]"
        : "text-[#000000]"
      : "text-[#000000]"
  } w-[30%] font-normal text-[12px] -tracking-[0.02rem]`}
>
  {activeTab === "Active"
    ? item.clientName || "N/A"
    : "status" in item
    ? item.status.toUpperCase()
    : "N/A"}
</div>

                      </div>
                     

                    </div>
                  );
                })
              ) : (
                <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[35%]"} justify-center`}>
                  <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                    <MdDoNotTouch size={40} color="gray" />
                  </div>
                  <p className="text-gray-900 font-medium text-[15px]">No {activeTab.toLowerCase()} projects found</p>
                  <p className="text-gray-500 text-[13px] mt-1 mb-5">Send request for a project or wait until you assign for a project!</p>
                
                </div>
              )}
            </div>
          ) : (
            <div className="py-10">
              <EmployeeProfile {...employeeProfile} />
            </div>
          )}
        </div>
      </div>
      {activeTab !== tabs[4] && (
        <div className="mt-8 w-full flex justify-center">
          <PaginationNav
            total={totalPages}
            current={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};

export default EmployeeLanding;