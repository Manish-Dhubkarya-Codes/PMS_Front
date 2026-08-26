import { useEffect, useState, useCallback, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainSearchBar from "../../UI_Components/SearchBars/MainSearchBar";
import Navigation1 from "../../UI_Components/Navigations/Navigation1";
import Filter from "../../UI_Components/Filter/Filter";
import Button1 from "../../UI_Components/Buttons/Button1";
import PaginationNav from "../../UI_Components/Navigations/PaginationNav";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import { TbFilterBolt } from "react-icons/tb";
import { FaCircleCheck } from "react-icons/fa6";
import { IoCloseCircle } from "react-icons/io5";
import { getData, postData, serverURL } from "../../BackendConnections/FetchBackendServices";
import PageLoadingComponent from "../../UI_Components/Pop_Ups/PageLoadingComponent";
import { AuthContext } from "../../Screens/Authentication/AuthContext";
import { useSocket } from "../../BackendConnections/useSocket";
import { RiLoader2Fill } from "react-icons/ri";
import { MdFolderOff } from "react-icons/md";
import ProgressTracking from "../../UI_Components/Progresses/ProgressTracking";
import Button2 from "../../UI_Components/Buttons/Button2";
import { countUnreadMessages, isNotifiableChatMessage, isQuietProjectStatus, playChatNotificationSound, unlockChatNotificationSound } from "../../utils/chatLive";
import { readStoredUserData } from "../../utils/authStorage";
import ActiveSinceLabel from "../../UI_Components/ActiveSinceLabel";

interface ProjectListProps {
  workstream: string;
  title: string;
  clientName: string;
  project_id: string;
  deadline: string;
  description: string;
  status?: string;
  budget?: number;
  active_date?: string | null;
}

interface RequestProps {
  request_id: number;
  project_id: string;
  employeeId: number;
  workstream: string;
  title: string;
  deadline: string;
  description: string | string[];
  clientName: string;
  employeeName: string;
  employeeDesignation: string;
  employeePic: string | null;
  status?: string;
}

interface GroupedRequestProps extends RequestProps {
  employees: { name: string; pic: string | null; id: number }[];
}

interface ProjectWithEmployees extends ProjectListProps {
  assignedEmployees?: string;
}

interface EmployeeRegRequest {
  id: string;
  workstream: string;
  deadline: string;
  title: string;
  clientName: string;
  employeeName: string;
  employeeMail: string;
  employmentID: string;
  employeeDesignation: string;
  gender: string;
  role: "Employee" | "Team Leader";
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
}

const getDateTime = (value?: string | number | null) => {
  if (value == null || value === "") return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const sortByLatestDate = <T extends { created_at?: string; id?: string }>(a: T, b: T) => {
  const aTime = getDateTime(a.created_at);
  const bTime = getDateTime(b.created_at);
  if (aTime !== bTime) return bTime - aTime;
  const aId = Number(a.id);
  const bId = Number(b.id);
  if (!Number.isNaN(aId) && !Number.isNaN(bId) && (aId || bId)) return bId - aId;
  return 0;
};

const TeamLeaderLanding: React.FC = () => {
  const authContext = useContext(AuthContext);
  const { logout: contextLogout } = authContext || {};

  const [tabs, setTabs] = useState<string[]>([]);
  const filters = ["Data Science", "AI", "Plagarism removal", "Thesis", "Software Development"];
  const statusFilterOptions = ["Pending", "Verified", "Rejected"];
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [renderDrawer, setRenderDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [projectDetails, setProjectDetails] = useState<ProjectListProps[]>([]);
  const [requests, setRequests] = useState<RequestProps[]>([]);
  const [employeeRegRequests, setEmployeeRegRequests] = useState<EmployeeRegRequest[]>([]);
  const [ongoingProjectIds, setOngoingProjectIds] = useState<string[]>([]);
  const [allProjectIds, setAllProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadInfo, setUnreadInfo] = useState<{ [project_id: string]: { unreadFromHead: number; unreadFromClient: number; unreadFromMonitor: number; hasMentionFromHead: boolean; hasMentionFromClient: boolean; headName: string; clientName: string; monitorName: string; } }>({});
  const [totalUnreadActive, setTotalUnreadActive] = useState<number>(0);
  const [totalUnreadAssigned, setTotalUnreadAssigned] = useState<number>(0);
  const [totalUnreadOngoing, setTotalUnreadOngoing] = useState<number>(0);
  const [totalUnreadRequests, setTotalUnreadRequests] = useState<number>(0);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const itemsPerPage = 6;
  const navigate = useNavigate();
  const prevProjectDetailsRef = useRef<ProjectListProps[]>([]);
  const prevRequestsRef = useRef<RequestProps[]>([]);
  const projectDetailsRef = useRef<ProjectListProps[]>([]);
  const requestsRef = useRef<RequestProps[]>([]);
  const initialLoadRef = useRef(false);
  const alignContainerRef = useRef<HTMLDivElement>(null);
  const navStartRef = useRef<HTMLDivElement>(null);
  const [tableStart, setTableStart] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectListProps | null>(null);
  // New: Department state
  const [department, setDepartment] = useState<string | null>(null);
  const [progress, setProgress] = useState({ start: 'no', payment: '0%', work: '0%' });
  const [verifyingIds, setVerifyingIds] = useState(new Set<string>());
  const [decliningIds, setDecliningIds] = useState(new Set<string>());
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedProgressProject, setSelectedProgressProject] = useState<ProjectListProps | null>(null);
  // Socket integration
  const { emitEvent, onEvent, connected } = useSocket();
  // Loading states for status updates
  const [loadingStatuses, setLoadingStatuses] = useState<{ [key: string]: 'Activating' | 'Holding' | 'Completing' | null }>({});

  // Fetch employee registrations (initial only, updates via socket)
  const fetchEmployees = useCallback(async () => {
    try {
      const employeeRegResponse = await getData('employees/fetch_all_registrations');
      if (employeeRegResponse.status && Array.isArray(employeeRegResponse.data)) {
        const sortedData = (employeeRegResponse.data as EmployeeRegRequest[]).sort(sortByLatestDate);
        setEmployeeRegRequests(sortedData);
      }
    } catch (err) {
      console.error("Fetch Employees Error:", err);
    }
  }, []);
const [totalPendingVerify, setTotalPendingVerify] = useState<number>(0);
useEffect(() => {
  setTotalPendingVerify(
    employeeRegRequests.filter((r) => r.status === "pending").length
  );
}, [employeeRegRequests]);
useEffect(() => {
  const parsedData = readStoredUserData();

  if (!parsedData) {
    // Don't redirect here again — checkRole already handles it
    setDepartment(null);
    return;
  }

  const designation = parsedData?.employeeDesignation || "";
  const deptMatch = designation.match(/\(([^)]+)\)$/);
  const dept = deptMatch ? deptMatch[1].trim() : null;
  setDepartment(dept);
}, []);

  useEffect(() => {
    const fetchProgress = async () => {
      if ((showModal && selectedProject) || (showProgressModal && selectedProgressProject)) {
        const proj = selectedProject || selectedProgressProject;
        try {
          const progressData = await getData(`clientproject/get_progress/${proj?.project_id}`);
          if (progressData.status) {
            setProgress(progressData.progress);
          }
        } catch (err) {
          console.error("Error fetching progress:", err);
        }
      }
    };
    fetchProgress();
  }, [showModal, selectedProject, showProgressModal, selectedProgressProject]);

  useEffect(() => {
    if (!connected || allProjectIds.length === 0) return;

    allProjectIds.forEach((projectId) => {
      emitEvent('joinProject', projectId);
    });

    if (department === "Technical") {
      ongoingProjectIds.forEach((projectId) => {
        emitEvent("joinTlMonitorRoom", projectId);
        emitEvent("joinEmployeeChat", projectId);
      });
    }

    return () => {
      allProjectIds.forEach((projectId) => {
        emitEvent("leaveProject", projectId);
      });
      if (department === "Technical") {
        ongoingProjectIds.forEach((projectId) => {
          emitEvent("leaveTlMonitorRoom", projectId);
        });
      }
    };
  }, [connected, allProjectIds, ongoingProjectIds, emitEvent, department]);

  useEffect(() => {
    projectDetailsRef.current = projectDetails;
  }, [projectDetails]);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  // Fetch projects and unread message info (initial only, updates via socket)
  const fetchUnreadInfo = useCallback(async (
    projectsArg?: ProjectListProps[],
    requestsArg?: RequestProps[],
  ) => {
    const allProjects: ProjectListProps[] = projectsArg || projectDetailsRef.current;
    const currentRequests: RequestProps[] = requestsArg || requestsRef.current;
    setAllProjectIds(allProjects.map(p => p.project_id));

    const ongoingProjects: ProjectWithEmployees[] = Object.values(
      currentRequests
        .filter((item) => item.status === "accepted" || item.status === "TLAssign")
        .reduce((acc: Record<string, ProjectWithEmployees>, item: RequestProps) => {
          if (!acc[item.project_id]) {
            acc[item.project_id] = {
              workstream: item.workstream,
              title: item.title,
              clientName: item.clientName,
              project_id: item.project_id,
              deadline: item.deadline,
              description: typeof item.description === "string" ? item.description : item.description.join(", "),
              assignedEmployees: item.employeeName,
            } as ProjectWithEmployees;
          } else {
            acc[item.project_id].assignedEmployees += ", " + item.employeeName;
          }
          return acc;
        }, {})
    );

    setOngoingProjectIds(ongoingProjects.map(p => p.project_id));

    const unreadPromises = allProjects.map(async (project: ProjectListProps) => {
      try {
        const response = await getData(`clientproject/get_project/${project.project_id}`);
        if (response.status && response.data) {
          const clientChats = response.data.clientchats || [];
          const clientAudios = response.data.clientaudios || [];
          const headChats = response.data.headchats || [];
          const headAudios = response.data.headaudios || [];
          const headName = response.data.headName || "Head";
          const clientName = response.data.clientName || "Client";

          const headUnread = countUnreadMessages(
            [...headChats, ...headAudios],
            "tl",
          );
          const clientUnread = countUnreadMessages(
            [...clientChats, ...clientAudios],
            "tl",
          );
          const unreadFromHead = headUnread.count;
          const unreadFromClient = clientUnread.count;
          const hasMentionFromHead = headUnread.hasMention;
          const hasMentionFromClient = clientUnread.hasMention;

          const tlMonitorResponse = await getData(`clientproject/get_tl_monitor_chats/${project.project_id}`);
          let unreadFromMonitor = 0;
          let monitorName = "Employee";
          if (tlMonitorResponse.status && tlMonitorResponse.data) {
            const monitorChats = tlMonitorResponse.data.monitorchats || [];
            const monitorAudios = tlMonitorResponse.data.monitoraudios || [];
            unreadFromMonitor = countUnreadMessages(
              [...monitorChats, ...monitorAudios],
              "tl",
            ).count;
            monitorName = tlMonitorResponse.data.monitorname || "Employee";
          }

          return {
            project_id: project.project_id,
            unreadFromHead,
            unreadFromClient,
            unreadFromMonitor,
            hasMentionFromHead,
            hasMentionFromClient,
            headName,
            clientName,
            monitorName
          };
        }
        // Default for project details
        const tlMonitorResponse = await getData(`clientproject/get_tl_monitor_chats/${project.project_id}`);
        let unreadFromMonitor = 0;
        let monitorName = "Employee";
        if (tlMonitorResponse.status && tlMonitorResponse.data) {
          const monitorChats = tlMonitorResponse.data.monitorchats || [];
          const monitorAudios = tlMonitorResponse.data.monitoraudios || [];
          unreadFromMonitor = countUnreadMessages(
            [...monitorChats, ...monitorAudios],
            "tl",
          ).count;
          monitorName = tlMonitorResponse.data.monitorname || "Employee";
        }

        return {
          project_id: project.project_id,
          unreadFromHead: 0,
          unreadFromClient: 0,
          unreadFromMonitor,
          hasMentionFromHead: false,
          hasMentionFromClient: false,
          headName: "Head",
          clientName: "Client",
          monitorName
        };
      } catch (err) {
        console.error(`Error fetching unread info for project ${project.project_id}:`, err);
        return {
          project_id: project.project_id,
          unreadFromHead: 0,
          unreadFromClient: 0,
          unreadFromMonitor: 0,
          hasMentionFromHead: false,
          hasMentionFromClient: false,
          headName: "Head",
          clientName: "Client",
          monitorName: "Employee"
        };
      }
    });
    const unreadResults = await Promise.all(unreadPromises);
    const unreadMap = unreadResults.reduce((acc: { [key: string]: { unreadFromHead: number; unreadFromClient: number; unreadFromMonitor: number; hasMentionFromHead: boolean; hasMentionFromClient: boolean; headName: string; clientName: string; monitorName: string; } }, result) => {
      acc[result.project_id] = {
        unreadFromHead: result.unreadFromHead,
        unreadFromClient: result.unreadFromClient,
        unreadFromMonitor: result.unreadFromMonitor,
        hasMentionFromHead: result.hasMentionFromHead,
        hasMentionFromClient: result.hasMentionFromClient,
        headName: result.headName,
        clientName: result.clientName,
        monitorName: result.monitorName
      };
      return acc;
    }, {});
    setUnreadInfo((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(unreadMap)) {
        return unreadMap;
      }
      return prev;
    });
  }, []);

  // ===== TOTAL UNREAD COUNTS FOR ALL TABS =====
useEffect(() => {
  const completedProjectIds = new Set(
    projectDetails
      .filter((item) => item.status === "Completed")
      .map((item) => String(item.project_id))
  );

  const activeIds = new Set(
    projectDetails
      .filter((p) =>
        p.status === "Active" &&
        !requests.some(
          (request) =>
            String(request.project_id) === String(p.project_id) &&
            ["pending", "accepted", "TLAssign"].includes(request.status || "")
        )
      )
      .map((p) => '' + p.project_id)
  );

  const ongoingIds = new Set(
    requests
      .filter((item) => ["accepted", "TLAssign"].includes(item.status || ""))
      .map((item) => '' + item.project_id)
      .filter((id) => !completedProjectIds.has(id))
  );

  const assignedIds = new Set(
    requests
      .filter((item) => ["accepted", "TLAssign"].includes(item.status || ""))
      .map((item) => '' + item.project_id)
      .filter((id) => !completedProjectIds.has(id))
  );

  // const pendingIds = new Set(
  //   requests
  //     .filter((item) => item.status === "pending")
  //     .map((item) => '' + item.project_id)
  // );

  const quietIds = new Set(
    projectDetails
      .filter((item) => isQuietProjectStatus(item.status))
      .map((item) => String(item.project_id))
  );

  setTotalUnreadActive(
    Array.from(activeIds).reduce((sum, id) => {
      if (quietIds.has(String(id))) return sum;
      const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
      return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
    }, 0)
  );

  setTotalUnreadOngoing(
    Array.from(ongoingIds).reduce((sum, id) => {
      if (quietIds.has(String(id))) return sum;
      const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
      return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
    }, 0)
  );

  setTotalUnreadAssigned(
    Array.from(assignedIds).reduce((sum, id) => {
      if (quietIds.has(String(id))) return sum;
      const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
      return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
    }, 0)
  );

setTotalUnreadRequests(
  requests.filter((item) => item.status === "pending").length
);

}, [unreadInfo, requests, projectDetails]);

  // Fetch projects and requests (initial only)
  const fetchProjectsAndRequests = useCallback(async () => {
    try {
      setError(null);

      const projectResponse = await getData("clientproject/show_all_clientsprojects");
      let nextProjects = prevProjectDetailsRef.current;
      if (projectResponse.status) {
        const newData = projectResponse.data || [];
        nextProjects = newData;
        setProjectDetails(newData);
        prevProjectDetailsRef.current = newData;
        projectDetailsRef.current = newData;
        setAllProjectIds(newData.map((p: any) => String(p.project_id)));
      } else {
        setError(projectResponse.message || "Failed to fetch projects.");
      }

      let nextRequests = prevRequestsRef.current;
      if (department === "Technical") {
        const requestResponse = await getData("clientproject/employee_requests");
        if (requestResponse.status) {
          const newData = requestResponse.data || [];
          nextRequests = newData;
          if (JSON.stringify(prevRequestsRef.current) !== JSON.stringify(newData)) {
            setRequests(newData);
            prevRequestsRef.current = newData;
            requestsRef.current = newData;
          }
        } else {
          setError(requestResponse.message || "Failed to fetch requests.");
        }
        await fetchUnreadInfo(nextProjects, nextRequests);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data. Please try again.");
      console.error("Fetch Error:", err);
    }
  }, [department, fetchUnreadInfo]);

  const fetchProjects = useCallback(async () => {
  try {
    const projectResponse = await getData("clientproject/show_all_clientsprojects");
    if (projectResponse.status) {
      const newData = projectResponse.data || [];
      setProjectDetails(newData);
      prevProjectDetailsRef.current = newData;
      projectDetailsRef.current = newData;
      setAllProjectIds(newData.map((p: any) => String(p.project_id)));
    }
  } catch (err) {
    console.error("Fetch Projects Error:", err);
  }
}, []);

useEffect(() => {
  if (!connected) return;

  const handleNewProject = (data?: any) => {
    if (data?.project_id) {
      setProjectDetails((prev) => {
        if (prev.some((p) => String(p.project_id) === String(data.project_id))) return prev;
        const next = [{
          project_id: String(data.project_id),
          title: data.title || "",
          workstream: data.workstream || "",
          clientName: data.clientName || "",
          status: data.status || "Hold",
          deadline: data.deadline ? String(data.deadline) : "",
          description: data.description || "",
          budget: data.budget,
        }, ...prev];
        prevProjectDetailsRef.current = next;
        projectDetailsRef.current = next;
        setAllProjectIds(next.map((p) => String(p.project_id)));
        return next;
      });
    }
    fetchProjects();
  };

  const off = onEvent("newProjectCreated", handleNewProject);
  return () => off?.();
}, [connected, onEvent, fetchProjects]);

// Join global room so Sales TL receives new projects
useEffect(() => {
  if (connected) {
    emitEvent("joinTlRoom", null);           // already present
    // Optional: also join a specific sales room if you want
    // emitEvent("joinSalesRoom", null);
  }
}, [connected, emitEvent]);

  // Initial fetch — Strict Mode remounts once, so reset the skip flag on cleanup.
  useEffect(() => {
    if (!department) return;
    let cancelled = false;
    if (!initialLoadRef.current) setLoading(true);
    fetchProjectsAndRequests()
      .then(() => {
        if (!cancelled && department === "Technical") {
          return fetchEmployees();
        }
      })
      .finally(() => {
        if (!cancelled) {
          initialLoadRef.current = true;
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [department, fetchProjectsAndRequests, fetchEmployees]);

  // Join rooms
  useEffect(() => {
    if (connected) {
      emitEvent('joinTlRoom', null);
      const me = readStoredUserData();
      if (me?.employeeId) emitEvent("joinEmployeeRoom", me.employeeId);
    }
  }, [connected, emitEvent, department]);

  useEffect(() => {
    if (!connected) return;
    const myId = readStoredUserData()?.employeeId;
    const handleBlocked = (data: { employeeId?: string | number }) => {
      if (myId != null && String(data?.employeeId) === String(myId)) {
        if (contextLogout) contextLogout();
        window.location.href = "/login-reg";
      }
    };
    const off = onEvent("employeeBlocked", handleBlocked);
    return () => off?.();
  }, [connected, onEvent, contextLogout]);

useEffect(() => {
  if (department !== "Technical") return;

  const handleNewEmployeeRequest = (data: any) => {
    console.log("Received newEmployeeRequest:", data);

    setRequests((prev) => {
      const exists = prev.some((req) => req.request_id === data.request_id);
      if (exists) return prev;

      const normalized = {
        ...data,
        status: data.status || "pending",
        employeeId: data.employeeId ?? data.employeeid,
        project_id: String(data.project_id),
      };

      return [...prev, normalized];
    });

    playChatNotificationSound();
  };

  const offNew = onEvent("newEmployeeRequest", handleNewEmployeeRequest);
  const handleAllRequests = (payload: { data?: RequestProps[] }) => {
    if (Array.isArray(payload?.data)) {
      setRequests(payload.data);
    } else {
      fetchProjectsAndRequests();
    }
  };
  const offAll = onEvent("allRequestsUpdate", handleAllRequests);

  return () => {
    offNew?.();
    offAll?.();
  };
}, [onEvent, department, fetchProjectsAndRequests]);

  // Listen for request status updates
  useEffect(() => {
    if (department !== "Technical") return;

    const handleRequestStatusUpdate = (data: { request_id: number; status: string; project_id?: string; employeeid?: number }) => {
      setRequests((prev) =>
        prev.map((req) => (req.request_id === data.request_id ? { ...req, status: data.status } : req))
      );
      // Refetch unread to update ongoing projects and monitor info
      setTimeout(() => fetchUnreadInfo(), 100);  // Slight delay to ensure state update
    };

    const off = onEvent("employeeRequestStatusUpdate", handleRequestStatusUpdate);

    return () => off?.();
  }, [onEvent, fetchUnreadInfo, department]);

  // Listen for new messages from project rooms (head, client)
  useEffect(() => {
    if (department !== "Technical") return;

    const handleNewMessage = (data: { fromRole: 'head' | 'client' | 'tl'; msg: any; projectId?: string }) => {
      if (!data.projectId || data.fromRole === 'tl') return;
      if (!isNotifiableChatMessage(data.msg, "tl")) return;

      setUnreadInfo((prev) => {
        const projectId = data.projectId!;
        const current = prev[projectId] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0, hasMentionFromHead: false, hasMentionFromClient: false, headName: "Head", clientName: "Client", monitorName: "Employee" };
        let updatedProject = { ...current };
        let isNewUnread = false;

        if (data.fromRole === 'head') {
          updatedProject.unreadFromHead++;
          isNewUnread = true;
          if (data.msg.mention?.type === 'tl') {
            updatedProject.hasMentionFromHead = true;
          }
        } else if (data.fromRole === 'client') {
          updatedProject.unreadFromClient++;
          isNewUnread = true;
          if (data.msg.mention?.type === 'tl') {
            updatedProject.hasMentionFromClient = true;
          }
        }

        if (isNewUnread) {
          queueMicrotask(() => playChatNotificationSound());
        }

        return { ...prev, [projectId]: updatedProject };
      });
    };

    const off = onEvent("newMessage", handleNewMessage);

    return () => off?.();
  }, [onEvent, department]);

  // Listen for new TL-Monitor messages (from monitor/employee)
  useEffect(() => {
    if (department !== "Technical") return;

    const handleNewTlMonitorMessage = (data: { fromRole: string; msg: any; projectId?: string }) => {
      if (!data.projectId || data.fromRole === 'tl') return;
      if (!isNotifiableChatMessage(data.msg, "tl")) return;

      setUnreadInfo((prev) => {
        const projectId = data.projectId!;
        const current = prev[projectId] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0, hasMentionFromHead: false, hasMentionFromClient: false, headName: "Head", clientName: "Client", monitorName: "Employee" };
        let updatedProject = { ...current };
        let isNewUnread = false;

        updatedProject.unreadFromMonitor++;
        isNewUnread = true;

        if (isNewUnread) {
          queueMicrotask(() => playChatNotificationSound());
        }

        return { ...prev, [projectId]: updatedProject };
      });
    };

    const off = onEvent("newTLMonitorMessage", handleNewTlMonitorMessage);

    return () => off?.();
  }, [onEvent, department]);

  useEffect(() => {
    setCurrentPage(1);
    if (activeTab === "On-Going" && department === "Technical") {
      fetchUnreadInfo();  // Refetch to sync any missed updates
    }
  }, [activeTab, fetchUnreadInfo, department]);

  // Listen for message seen (project rooms)
  useEffect(() => {
    if (department !== "Technical") return;

    const handleMessageSeen = (data: { fromRole: 'head' | 'client' | 'tl'; index: number; seen_by: string[]; type: 'chat' | 'audio'; projectId?: string }) => {
      if (!data.projectId) return;
      // Refetch unread for accuracy (could optimize, but refetch is simple)
      fetchUnreadInfo();
    };

    const off = onEvent("messageSeen", handleMessageSeen);

    return () => off?.();
  }, [onEvent, fetchUnreadInfo, department]);

  // Listen for TL-Monitor message seen
  useEffect(() => {
    if (department !== "Technical") return;

    const handleTlMonitorMessageSeen = (data: { fromTL: boolean; seen_by: string[]; timestamp?: string; projectId?: string }) => {
      if (!data.projectId) return;
      // Refetch unread for accuracy
      fetchUnreadInfo();
    };

    const off = onEvent("tlMonitorMessageSeen", handleTlMonitorMessageSeen);

    return () => off?.();
  }, [onEvent, fetchUnreadInfo, department]);

  // Keep Verify Employee live for Technical TL even when not on that tab.
  useEffect(() => {
    if (!connected) return;

    const handleEmployeeRegUpdate = (data: { id: string; status: 'pending' | 'accepted' | 'rejected' }) => {
      setEmployeeRegRequests((prev) =>
        prev
          .map((item) =>
            String(item.id) === String(data.id) ? { ...item, status: data.status } : item
          )
          .sort(sortByLatestDate)
      );
    };

    const handleNewEmployeeRegistration = (data: EmployeeRegRequest) => {
      setEmployeeRegRequests((prev) => {
        if (prev.some((item) => String(item.id) === String(data.id))) return prev;
        return [{ ...data, id: String(data.id), status: data.status || "pending" }, ...prev].sort(sortByLatestDate);
      });
      fetchEmployees();
    };

    const offUpdate = onEvent("employeeRegUpdate", handleEmployeeRegUpdate);
    const offReg = onEvent("newEmployeeRegistration", handleNewEmployeeRegistration);
    return () => {
      offUpdate?.();
      offReg?.();
    };
  }, [connected, onEvent, fetchEmployees]);

  useEffect(() => {
    if (department !== "Technical") return;
    fetchEmployees();
    const interval = window.setInterval(fetchEmployees, 8000);
    return () => window.clearInterval(interval);
  }, [department, fetchEmployees]);

  useEffect(() => {
    if (department !== "Sales") return;
    fetchProjects();
    const interval = window.setInterval(fetchProjects, 8000);
    return () => window.clearInterval(interval);
  }, [department, fetchProjects]);

  // Listen for project status updates (both event names — backend emits projectStatusUpdated)
  useEffect(() => {
    const handleProjectStatusUpdate = (data: {
      projectId?: string;
      project_id?: string;
      status: string;
      active_date?: string | null;
    }) => {
      const id = String(data.projectId ?? data.project_id ?? "");
      if (!id) return;
      setProjectDetails((prev) => {
        const exists = prev.some((p) => String(p.project_id) === id);
        if (!exists) {
          queueMicrotask(() => fetchProjects());
          return prev;
        }
        return prev.map((p) =>
          String(p.project_id) === id
            ? { ...p, status: data.status, active_date: data.active_date ?? p.active_date }
            : p
        );
      });
    };

    const offA = onEvent("projectStatusUpdated", handleProjectStatusUpdate);
    const offB = onEvent("projectStatusUpdate", handleProjectStatusUpdate);

    return () => {
      offA?.();
      offB?.();
    };
  }, [onEvent, fetchProjects]);

useEffect(() => {
  const checkRole = async () => {
    const storedUserDataB64 = localStorage.getItem("userData");
    const storedRoleB64 = localStorage.getItem("role");

    // If no user data → immediately hard redirect (cleanest way)
    if (!storedUserDataB64 || !storedRoleB64) {
      console.warn("No user data or role found. Logging out...");
      if (contextLogout) contextLogout();
      
      // Hard redirect - most reliable way to break the loop
      window.location.href = "/login-reg";
      return;
    }

    try {
      const storedUserData = JSON.parse(atob(storedUserDataB64));
      const role = atob(storedRoleB64);

      // Extract department safely
      const designation = storedUserData?.employeeDesignation || "";
      const deptMatch = designation.match(/\(([^)]+)\)$/);
      const dept = deptMatch ? deptMatch[1].trim() : null;
      setDepartment(dept);

      const { employeeId } = storedUserData;

      if (!employeeId || !role) {
        window.location.href = "/login-reg";
        return;
      }

      // Verify with backend
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
}, []); // ← Empty dependency array is important

  useEffect(() => {
    if (department) {
      if (department === "Sales") {
        const savedTabs = ["SOP List", "Active", "Completed"];
        setTabs(savedTabs);
        const saved = localStorage.getItem("tlLandingActiveTab");
        setActiveTab(saved && savedTabs.includes(saved) ? saved : "SOP List");
      } else {
        const savedTabs = ["Active", "Assigned", "Requests", "On-Going", "Completed", "Verify Employee"];
        setTabs(savedTabs);
        const saved = localStorage.getItem("tlLandingActiveTab");
        setActiveTab(saved && savedTabs.includes(saved) ? saved : "Requests");
      }
    }
  }, [department]);

  const handleVerifyEmployee = async (requestId: string, currentStatus?: string) => {
    if (verifyingIds.has(requestId)) return;
    if (currentStatus === "rejected" && !window.confirm("Re-verify this rejected employee? They can log in with their existing details without registering again.")) {
      return;
    }

    setVerifyingIds((prev) => new Set([...prev, requestId]));

    try {
      const response = await postData(`employees/admin/accept_employee_request/${requestId}`, {});
      if (response.status) {
        setEmployeeRegRequests((prev) =>
          prev
            .map((item) =>
              item.id === requestId ? { ...item, status: "accepted" as const } : item
            )
            .sort(sortByLatestDate)
        );
      } else {
        window.alert(response.message || "Failed to verify employee.");
      }
    } catch (err) {
      window.alert("Failed to verify employee. Please try again.");
      console.error("Verify Error:", err);
    } finally {
      setVerifyingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleDeclineEmployee = async (requestId: string, currentStatus?: string) => {
    if (decliningIds.has(requestId)) return;
    if (currentStatus === "accepted" && !window.confirm("Block this verified employee? They will be logged out and cannot open the app until re-verified.")) {
      return;
    }

    setDecliningIds((prev) => new Set([...prev, requestId]));

    try {
      const response = await postData(`employees/admin/reject_employee_request/${requestId}`, {});
      if (response.status) {
        setEmployeeRegRequests((prev) =>
          prev
            .map((item) =>
              item.id === requestId ? { ...item, status: "rejected" as const } : item
            )
            .sort(sortByLatestDate)
        );
      } else {
        window.alert(response.message || "Failed to decline employee.");
      }
    } catch (err) {
      window.alert("Failed to decline employee. Please try again.");
      console.error("Decline Error:", err);
    } finally {
      setDecliningIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    if (activeTab === "Verify Employee") {
      setSelectedFilters([]);
    } else {
      setStatusFilters([]);
    }
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters, statusFilters, activeTab]);

  const requestedProjectIds = new Set(
    requests
      .filter((item) => item.status === "pending" || item.status === "accepted" || item.status === "TLAssign")
      .map((item) => String(item.project_id))
  );
  

  const groupedPendingRequests = requests
    .filter((item) => item.status === "pending")
    .reduce((acc, item) => {
      if (!acc[item.project_id]) {
        acc[item.project_id] = {
          ...item,
          employees: [{ name: item.employeeName, pic: item.employeePic, id: item.employeeId }],
        };
      } else {
        acc[item.project_id].employees.push({
          name: item.employeeName,
          pic: item.employeePic,
          id: item.employeeId,
        });
      }
      return acc;
    }, {} as Record<string, GroupedRequestProps>);

  const groupedOngoingRequests = requests
    .filter((item) => item.status === "accepted" || item.status === "TLAssign")
    .reduce((acc, item) => {
      if (!acc[item.project_id]) {
        acc[item.project_id] = {
          ...item,
          employees: [{ name: item.employeeName, pic: item.employeePic, id: item.employeeId }],
        };
      } else {
        acc[item.project_id].employees.push({
          name: item.employeeName,
          pic: item.employeePic,
          id: item.employeeId,
        });
      }
      return acc;
    }, {} as Record<string, GroupedRequestProps>);

  const filteredEmployeeRequests = employeeRegRequests.filter(
    (item) =>
      (item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.employeeMail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.employmentID.toString().includes(searchQuery)) &&
      (statusFilters.length === 0 ||
        statusFilters.some(filter =>
          (filter === "Pending" && item.status === "pending") ||
          (filter === "Verified" && item.status === "accepted") ||
          (filter === "Rejected" && item.status === "rejected")
        ))
  ).slice().sort(sortByLatestDate);

  const completedProjectIds = new Set(
    projectDetails
      .filter((item: ProjectListProps) => item.status === "Completed")
      .map((item: ProjectListProps) => String(item.project_id))
  );

const filteredItems =
  department === "Technical"
    ? activeTab === "Active"
      ? projectDetails.filter((item: ProjectListProps) =>
          item.status === "Active" &&
          !requestedProjectIds.has(String(item.project_id)) &&
          (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.project_id.toString().includes(searchQuery) ||
            item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (typeof item.description === "string" &&
              item.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
          (selectedFilters.length === 0 ||
            selectedFilters.some((filter) =>
              filter.toLowerCase().includes(item.workstream.toLowerCase())
            ))
        )
      : activeTab === "Assigned"
        ? Object.values(groupedOngoingRequests)
            .filter((item: GroupedRequestProps) =>
              !completedProjectIds.has(String(item.project_id)) &&
              (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.project_id.toString().includes(searchQuery) ||
                item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.employees.some((emp) => emp.name.toLowerCase().includes(searchQuery.toLowerCase()))) &&
              (selectedFilters.length === 0 ||
                selectedFilters.some((filter) =>
                  filter.toLowerCase().includes(item.workstream.toLowerCase())
                ))
            )
            .map((item: GroupedRequestProps) => {
  const proj = projectDetails.find(p => String(p.project_id) === String(item.project_id));
  return {
    ...item,
    assignedEmployees: item.employees.map((emp) => emp.name).join(", "),
    active_date: proj?.active_date || null,
    status: proj?.status || item.status,
  } as ProjectWithEmployees;
})
      : activeTab === "Requests"
  ? Object.values(groupedPendingRequests).filter((item: GroupedRequestProps) =>
            (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.project_id.toString().includes(searchQuery) ||
              item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.employees.some((emp) => emp.name.toLowerCase().includes(searchQuery.toLowerCase()))) &&
            (selectedFilters.length === 0 ||
              selectedFilters.some((filter) =>
                filter.toLowerCase().includes(item.workstream.toLowerCase())
              ))
          )
      : activeTab === "On-Going"
        ? Object.values(groupedOngoingRequests)
            .filter((item: GroupedRequestProps) =>
              !completedProjectIds.has(String(item.project_id)) &&
              (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.project_id.toString().includes(searchQuery) ||
                item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.employees.some((emp) => emp.name.toLowerCase().includes(searchQuery.toLowerCase()))) &&
              (selectedFilters.length === 0 ||
                selectedFilters.some((filter) =>
                  filter.toLowerCase().includes(item.workstream.toLowerCase())
                ))
            )
            .map((item: GroupedRequestProps) => {
              const proj = projectDetails.find(p => String(p.project_id) === String(item.project_id));
              return {
                ...item,
                assignedEmployees: item.employees.map((emp) => emp.name).join(", "),
                active_date: proj?.active_date || null,
                status: proj?.status || item.status,
              } as ProjectWithEmployees;
            })
      : activeTab === "Completed"
        ? projectDetails.filter((item: ProjectListProps) =>
            item.status === "Completed" &&
            (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.project_id.toString().includes(searchQuery) ||
              item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (typeof item.description === "string" &&
                item.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
            (selectedFilters.length === 0 ||
              selectedFilters.some((filter) =>
                filter.toLowerCase().includes(item.workstream.toLowerCase())
              ))
          )
      : activeTab === "Verify Employee"
        ? filteredEmployeeRequests
        : []
    : department === "Sales"
      ? activeTab === "SOP List"
        ? projectDetails.filter((item: ProjectListProps) =>
            item.status !== "Completed" &&
            (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.project_id.toString().includes(searchQuery) ||
              item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (typeof item.description === "string" &&
                item.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
            (selectedFilters.length === 0 ||
              selectedFilters.some((filter) =>
                filter.toLowerCase().includes(item.workstream.toLowerCase())
              ))
          )
        : activeTab === "Active"
          ? projectDetails.filter((item: ProjectListProps) =>
              item.status === "Active" &&
              (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.project_id.toString().includes(searchQuery) ||
                item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (typeof item.description === "string" &&
                  item.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
              (selectedFilters.length === 0 ||
                selectedFilters.some((filter) =>
                  filter.toLowerCase().includes(item.workstream.toLowerCase())
                ))
            )
          : activeTab === "Completed"
            ? projectDetails.filter((item: ProjectListProps) =>
                item.status === "Completed" &&
                (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.project_id.toString().includes(searchQuery) ||
                  item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (typeof item.description === "string" &&
                    item.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
                (selectedFilters.length === 0 ||
                  selectedFilters.some((filter) =>
                    filter.toLowerCase().includes(item.workstream.toLowerCase())
                  ))
              )
            : []
      : [];

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  const maxTextLength = Math.max(
    ...projectDetails.map((item) => item.deadline.length),
    ...requests.map((item) => item.deadline.length),
    10
  );

  const maxEmployeeRequestTextLength = Math.max(
    ...employeeRegRequests.map((item) => (item.employeeName + item.employmentID).length),
    10
  );

  const getWidthClass = (maxLength: number) =>
    maxLength > 30 ? "w-[300px]" : maxLength > 20 ? "w-[250px]" : "w-[200px]";

  const widthClass = getWidthClass(maxTextLength);

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
  const isMobileLayout = isXXS || isXS || isSM || isMD;
  const isTechnicalDesktop = department === "Technical" && !isMobileLayout;
  const textSize = is2XL ? "text-[15px]" : "text-[12px]";

  const updateTableStart = useCallback(() => {
    const container = alignContainerRef.current;
    const nav = navStartRef.current;
    if (!container || !nav) return;
    const firstTab = nav.querySelector<HTMLElement>("[data-nav-start]");
    if (!firstTab) return;
    const strip = firstTab.parentElement ?? nav;
    const offset =
      strip.getBoundingClientRect().left -
      container.getBoundingClientRect().left +
      firstTab.offsetLeft;
    setTableStart(Math.max(0, Math.round(offset)));
  }, []);

  useEffect(() => {
    if (isTechnicalDesktop) return;
    const frame = requestAnimationFrame(updateTableStart);
    const container = alignContainerRef.current;
    const nav = navStartRef.current;
    if (!container) {
      return () => cancelAnimationFrame(frame);
    }
    const ro = new ResizeObserver(updateTableStart);
    ro.observe(container);
    if (nav) ro.observe(nav);
    window.addEventListener("resize", updateTableStart);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", updateTableStart);
    };
  }, [updateTableStart, loading, width, tabs.length, isTechnicalDesktop]);

  const handleRequestTab = (item: GroupedRequestProps) => {
    navigate("/teamleaderprojectass", {
      state: {
        selectedRequest: item,
      },
    });
  };

  useEffect(() => {
    unlockChatNotificationSound();
  }, []);

  if (loading) {
    return <PageLoadingComponent />;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }
  /* Helper components for icons (place these outside your render) */
  // const IconAt = () => (
  //   <svg
  //     className="w-4 h-4 text-blue-600 flex-shrink-0"
  //     xmlns="http://www.w3.org/2000/svg"
  //     fill="none"
  //     viewBox="0 0 24 24"
  //     strokeWidth={1.5}
  //     stroke="currentColor"
  //   >
  //     <path
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //       d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25"
  //     />
  //   </svg>
  // );

  // const IconChat = () => (
  //   <svg
  //     className="w-4 h-4 text-gray-600 flex-shrink-0"
  //     xmlns="http://www.w3.org/2000/svg"
  //     fill="none"
  //     viewBox="0 0 24 24"
  //     strokeWidth={1.5}
  //     stroke="currentColor"
  //   >
  //     <path
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //       d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.04 8.25-6.75 8.25a9.75 9.75 0 01-6.75-3.032m0 0A9.753 9.753 0 013 12c0-4.556 3.04-8.25 6.75-8.25a9.75 9.75 0 016.75 3.032m0 0A9.753 9.753 0 0121 12z"
  //     />
  //   </svg>
  // );

  const UnreadDots = ({
  showGreen,
  showBlue,
  onDismiss,
}: {
  showGreen: boolean;
  showBlue: boolean;
  onDismiss: (e: React.MouseEvent) => void;
}) => {
  if (!showGreen && !showBlue) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 ml-1.5">
      {showGreen && (
        <span
          className="relative flex h-3 w-3 cursor-pointer"
          title="New message"
          onClick={onDismiss}
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      )}
      {showBlue && (
        <span
          className="relative flex h-3 w-3 cursor-pointer"
          title="You were tagged"
          onClick={onDismiss}
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </span>
      )}
    </div>
  );
};

  const handleUpdateStatus = async (projectId: string, newStatus: string) => {
    const confirmed = confirm(`Are you sure you want to change the project status to ${newStatus}?`);
    if (!confirmed) return;

    try {
      const loadingText = newStatus === 'Active' ? 'Activating' : newStatus === 'Hold' ? 'Holding' : 'Completing';
      setLoadingStatuses((prev) => ({ ...prev, [projectId]: loadingText }));

      const response = await postData(`clientproject/update_project_status/${projectId}`, { status: newStatus });

      if (response.status) {
        const nextActiveDate = response.data?.active_date || (newStatus === "Active" ? new Date().toISOString() : null);
        setProjectDetails((prev) =>
          prev.map((p) =>
            String(p.project_id) === String(projectId)
              ? {
                  ...p,
                  status: newStatus,
                  active_date: nextActiveDate ?? p.active_date ?? null,
                }
              : p
          )
        );

        // 🔥 SEND ACTIVATION EMAIL (only when Sales activates)
        if (newStatus === 'Active' && department === "Sales") {
          const project = projectDetails.find((p) => p.project_id === projectId);
          await postData('employees/send_project_activation_email', {
            projectId,
            projectTitle: project?.title || 'Untitled Project',
            workstream: project?.workstream || ''
          });
        }
      } else {
        setError(response.message || "Failed to update status.");
      }
    } catch (err) {
      console.error("Update Status Error:", err);
      setError("Failed to update status. Please try again.");
    } finally {
      setLoadingStatuses((prev) => ({ ...prev, [projectId]: null }));
    }
  };

  const handleStepClick = async (index: any) => {
    const nextPercent = (index + 1) * 20 + '%';
    if (window.confirm(`Update the payment progress to ${nextPercent}`)) {
      try {
        const res = await postData(`clientproject/update_progress/${selectedProgressProject?.project_id}`, { type: 'payment' });  // FIXED: selectedProgressProject
        if (res.status) {
          setProgress(res.progress);
        }
      } catch (err) {
        console.error("Error updating progress:", err);
      }
    }
  };

  return (
    <div
      className={`flex w-full text-black ${isXL || is2XL
          ? "flex-col min-h-screen py-[10vh] px-[10vw] items-center justify-start space-y-6"
          : isLG
            ? "flex-col min-h-screen py-[10vh] px-[5vw] items-center justify-start space-y-6"
            : "flex-col relative min-h-screen py-[10vh] px-[5vw] items-center justify-start space-y-6"
        }`}
    >
      <MainNavigation isMenuHide={false} />
      <div
        className={`flex ${isMobileLayout
            ? "w-full justify-center items-center space-x-[10vw]"
            : "w-full items-center justify-center"
          }`}
      >
        <div className={`${isMobileLayout ? "w-fit overflow-x-auto" : isTechnicalDesktop ? "w-full min-w-0" : "w-full overflow-visible"} flex items-center flex-col space-y-4`}>
          <div className="w-full flex justify-center items-center">
            <div className="w-fit flex items-center space-x-10">
              {isMobileLayout && (
                <div>
                  <TbFilterBolt size={25} onClick={() => setShowFilter(true)} />
                </div>
              )}
              <MainSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            </div>
          </div>
          <div
            ref={alignContainerRef}
            className={
              isMobileLayout
                ? "flex w-full flex-col items-center"
                : isTechnicalDesktop
                  ? "grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-8 gap-y-6 items-start"
                  : "w-full flex flex-col overflow-visible"
            }
          >
            <div
              ref={navStartRef}
              className={
                isTechnicalDesktop
                  ? "col-start-2 row-start-1 min-w-0 w-full relative z-10"
                  : "w-full flex justify-center overflow-visible relative z-10"
              }
            >
              <Navigation1
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  localStorage.setItem("tlLandingActiveTab", tab);
                }}
                totalUnreadActive={totalUnreadActive}
                totalUnreadOngoing={totalUnreadOngoing}
                totalUnreadAssigned={totalUnreadAssigned}
                totalUnreadRequests={totalUnreadRequests}
                totalPendingVerify={totalPendingVerify}
                centered={!isTechnicalDesktop}
                scrollable={department === "Technical"}
              />
            </div>
            <div
              className={
                isTechnicalDesktop
                  ? "contents"
                  : "relative flex w-full items-start mt-6"
              }
            >
              {isMobileLayout ? (
                renderDrawer && (
                  <div
                    className={`
                      fixed top-9 left-0 w-[280px] z-50 bg-blue-50 p-4 rounded-br-[10px]
                      transform transition-transform duration-300 ease-in-out
                      ${drawerVisible ? "translate-x-0" : "-translate-x-full"}
                    `}
                  >
                    <Filter
                      filters={activeTab === "Verify Employee" ? statusFilterOptions : filters}
                      setSelectedFilters={activeTab === "Verify Employee" ? setStatusFilters : setSelectedFilters}
                      setClose={() => setShowFilter(false)}
                    />
                  </div>
                )
              ) : (
                <div className={isTechnicalDesktop ? "col-start-1 row-start-2 shrink-0 [&>div]:mx-0" : "absolute left-0 top-0 [&>div]:mx-0"}>
                  <Filter
                    filters={activeTab === "Verify Employee" ? statusFilterOptions : filters}
                    setSelectedFilters={activeTab === "Verify Employee" ? setStatusFilters : setSelectedFilters}
                    setClose={setShowFilter}
                  />
                </div>
              )}
              <div
                className={
                  isMobileLayout
                    ? "flex w-full flex-col"
                    : isTechnicalDesktop
                      ? "col-start-2 row-start-2 min-w-0 pl-8"
                      : "w-full min-w-0 flex-1"
                }
                style={isMobileLayout || isTechnicalDesktop ? undefined : { paddingLeft: tableStart }}
              >
          <div className={`${isTechnicalDesktop || activeTab === "Active" ? "overflow-x-hidden w-full min-w-0" : "overflow-x-auto"} space-y-5`}>
            {department === "Technical" ? (
              activeTab === "Requests" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item, index) => {
                    if ("employees" in item) {
                      const displayEmployees = item.employees.slice(0, 3);
                      const extraCount = item.employees.length - 3;

                      return (
                        <div
                          onClick={() => handleRequestTab(item)}
                          key={index}
                          className={`flex cursor-pointer justify-start items-start w-full ${isTechnicalDesktop ? "min-w-0" : "min-w-[700px]"} flex-col`}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full">
                            <div className="flex gap-2 items-center justify-start w-full">
                              <Button1
                                width={widthClass}
                                gradientType="gradient1"
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={item.workstream}
                              />
                             <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className="font-mono ${textSize} font-bold text-slate-900 tracking-tight">
    {"ID:" + item.project_id}
  </span>

  {/* GREEN DOT for new pending request */}
{/* GREEN DOT for new pending request */}
{(() => {
  const hasPending = requests.some(
    (r) => String(r.project_id) === String(item.project_id) && r.status === "pending"
  );
  const notifKey = String(item.request_id ?? item.project_id);

  return hasPending && !dismissedNotifications.has(notifKey) ? (
    <span
      className="relative flex h-3 w-3 cursor-pointer ml-2"
      title="New employee request"
      onClick={(e) => {
        e.stopPropagation();
        setDismissedNotifications(
          (prev) => new Set([...prev, notifKey])
        );
      }}
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
    </span>
  ) : null;
})()}

</div>
                            </div>
                            <div className="border-t-2 border-[#000000] w-full"></div>
                          </div>
                          <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
                            <div
                              className={`text-[#000000] w-[35%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              {item.title}
                            </div>
                            <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
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
    status={(item as any).project_status || (item as any).status}
  />
</div>
                            <div className="flex w-[30%] items-center justify-center">
                              {displayEmployees.map((emp, idx) => {
                                const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
                                return (
                                  <div
                                    key={idx}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm border-2 border-white
                                      ${idx !== 0 ? "-ml-3" : ""}`}
                                    style={{
                                      backgroundColor: emp.pic ? "transparent" : randomColor,
                                    }}
                                  >
                                    {emp.pic ? (
                                      <img
                                        src={`${serverURL}/files/${emp.pic}`}
                                        alt={emp.name}
                                        className="w-full h-full rounded-full"
                                      />
                                    ) : (
                                      emp.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                );
                              })}
                              {extraCount > 0 && (
                                <div className="-ml-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm bg-gray-500 border-2 border-white">
                                  +{extraCount}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center  justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No request found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Not a employee send request for project </p>

                  </div>
                )
              ) : activeTab === "Active" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item, index) => {
                    const projectItem = item as ProjectListProps;
                    const unreadInfoForProject = unreadInfo[projectItem.project_id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0, hasMentionFromHead: false, hasMentionFromClient: false, headName: "Head", clientName: "Client", monitorName: "Employee" };
                    return (
                      <div
                        key={index}
                        className={`flex relative justify-start items-start w-full min-w-0 flex-col`}
                      >
                        <div className="flex flex-col-reverse items-start justify-start w-full min-w-0">
                          <div className="flex items-start justify-between w-full min-w-0 gap-2">
                            <div className="flex gap-2 items-center justify-start min-w-0 flex-1">
                            <Button1
                              width={widthClass}
                              gradientType="gradient1"
                              text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                              value={item.workstream}
                            />
                            <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className="font-mono ${textSize} font-bold text-slate-900 tracking-tight">
    {"ID:"+projectItem.project_id}
  </span>
</div>
</div>
<div className="flex items-center space-x-3 shrink-0">
  <div className="flex items-center">
    <div
      className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
                 bg-blue-600 text-xs font-medium text-white
                 transition-colors hover:bg-blue-500"
      style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
      onClick={() =>
        navigate(`/teamleaderprojectinfo`, {
          state: { item: projectItem },
        })
      }
    >
      Talk to Client/Head
    </div>
    {!dismissedNotifications.has(projectItem.project_id) &&
      !isQuietProjectStatus((projectItem as any).status) && (
      <UnreadDots
        showGreen={
          (unreadInfoForProject.unreadFromHead || 0) +
            (unreadInfoForProject.unreadFromClient || 0) >
          0
        }
        showBlue={
          unreadInfoForProject.hasMentionFromHead ||
          unreadInfoForProject.hasMentionFromClient
        }
        onDismiss={(e) => {
          e.stopPropagation();
          setDismissedNotifications((prev) =>
            new Set([...prev, projectItem.project_id])
          );
        }}
      />
    )}
  </div>
</div>
                          </div>
                          <div className="border-t-2 border-[#000000] w-full"></div>
                        </div>
                        <div className="flex mt-3 w-full pl-[2vw] justify-between items-center min-w-0 gap-2">
                          <div
                            className={`text-[#000000] w-[35%] min-w-0 break-words text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                              } -tracking-[0.02rem]`}
                          >
                            {item.title}
                          </div>
                         <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] min-w-0 ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
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
    status={(item as any).project_status || (item as any).status}
  />
</div>
                          <div
                            className={`text-[#000000]  w-[30%] min-w-0 break-words font-normal text-[12px] -tracking-[0.02rem]`}
                          >
                            {item.clientName || "N/A"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center  justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No active projects found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters/move to On-Going tab or not active by Sales Team </p>

                  </div>
                )
                ) : activeTab === "Assigned" ? (
  filteredItems.length > 0 ? (
    currentItems.map((item, index) => {
      if ("assignedEmployees" in item) {
        const projectItem = item as ProjectWithEmployees;
        const employeeNames = projectItem.assignedEmployees?.split(", ") || [];
        const firstEmployee = employeeNames[0] || "N/A";
        const extraCount = employeeNames.length - 1;

        const unreadInfoForProject = unreadInfo[projectItem.project_id] || {
          unreadFromHead: 0,
          unreadFromClient: 0,
          unreadFromMonitor: 0,
          hasMentionFromHead: false,
          hasMentionFromClient: false,
          headName: "Head",
          clientName: "Client",
          monitorName: "Employee",
        };

        return (
          <div
            key={index}
            className={`flex relative justify-start items-start w-full ${isTechnicalDesktop ? "min-w-0" : "min-w-[700px]"} flex-col`}
          >
            <div className="flex flex-col-reverse items-start justify-start w-full min-w-0">
              <div className="flex items-start justify-between w-full min-w-0 gap-2">
                <div className="flex gap-2 items-center justify-start min-w-0 flex-1">
                <Button1
                  gradientType="gradient1"
                  width={widthClass}
                  text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                  value={projectItem.workstream}
                />
                <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className="font-mono ${textSize} font-bold text-slate-900 tracking-tight">
    {"ID:"+projectItem.project_id}
  </span>
</div>
</div>

               <div className="flex items-center space-x-3 shrink-0">
  {/* Talk to Client/Head */}
  <div className="flex items-center">
    <div
      className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
                 bg-blue-600 text-xs font-medium text-white
                 transition-colors hover:bg-blue-500"
      style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
      onClick={() => navigate(`/teamleaderprojectinfo`, { state: { item: projectItem } })}
    >
      Talk to Client/Head
    </div>
    {!dismissedNotifications.has(projectItem.project_id) &&
      !isQuietProjectStatus((projectItem as any).status) && (
      <div className="flex items-center gap-1.5 ml-1.5">
        {((unreadInfoForProject.unreadFromHead || 0) + (unreadInfoForProject.unreadFromClient || 0) > 0) && (
          <span
            className="relative flex h-3 w-3 cursor-pointer"
            title="New message from Client/Head"
            onClick={(e) => {
              e.stopPropagation();
              setDismissedNotifications((prev) => new Set([...prev, projectItem.project_id]));
            }}
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
        )}
        {(unreadInfoForProject.hasMentionFromHead || unreadInfoForProject.hasMentionFromClient) && (
          <span
            className="relative flex h-3 w-3 cursor-pointer"
            title="You were tagged"
            onClick={(e) => {
              e.stopPropagation();
              setDismissedNotifications((prev) => new Set([...prev, projectItem.project_id]));
            }}
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
        )}
      </div>
    )}
  </div>

  {/* Talk to Employee */}
  <div className="flex items-center">
    <div
      className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
                 bg-slate-700 text-xs font-medium text-white
                 transition-colors hover:bg-slate-600"
      style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
      onClick={() => navigate(`/teamleaderprojectinfo_withemployee`, { state: { item: projectItem } })}
    >
      Talk to Employee
    </div>
    {!dismissedNotifications.has(projectItem.project_id) &&
      !isQuietProjectStatus((projectItem as any).status) &&
      (unreadInfoForProject.unreadFromMonitor || 0) > 0 && (
      <div className="flex items-center gap-1.5 ml-1.5">
        <span
          className="relative flex h-3 w-3 cursor-pointer"
          title="New message from Employee"
          onClick={(e) => {
            e.stopPropagation();
            setDismissedNotifications((prev) => new Set([...prev, projectItem.project_id]));
          }}
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      </div>
    )}
  </div>
</div>
              </div>
              <div className="border-t-2 border-[#000000] w-full"></div>
            </div>

            <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
              <div className={`text-[#000000] w-[35%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}>
                {projectItem.title}
              </div>
              <div className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}>
                <div>
                  Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </div>
                <ActiveSinceLabel
                  activeDate={(projectItem as any).active_date}
                  status={(projectItem as any).project_status || (projectItem as any).status}
                />
              </div>
              <div className={`text-[#000000] w-[30%] font-normal ${textSize} -tracking-[0.02rem] justify-center flex items-center gap-1`}>
                {extraCount > 0 ? (
                  <>
                    {firstEmployee}
                    <span className="ml-1 px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-[11px]">+{extraCount}</span>
                  </>
                ) : (
                  firstEmployee
                )}
              </div>
            </div>

          </div>
        );
      }
      return null;
    })
  ) : (
    <div className={`mt-7 flex flex-col items-center  justify-center`}>
      <div className="bg-white p-3 rounded-full shadow-sm mb-4">
        <MdFolderOff color="gray" size={40} />
      </div>
      <p className="text-gray-900 font-medium text-[15px]">No Assigned projects found</p>
      <p className="text-gray-500 text-[13px] mt-1 mb-5">Check filters or move to another tab</p>
    </div>
  )
                // here need to paste the Assigned code?
              ) : activeTab === "On-Going" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item, index) => {
                    if ("assignedEmployees" in item) {
                      const projectItem = item as ProjectWithEmployees;
                      const employeeNames = projectItem.assignedEmployees?.split(", ") || [];
                      const firstEmployee = employeeNames[0] || "N/A";
                      const extraCount = employeeNames.length - 1;
                      const unreadInfoForProject = unreadInfo[projectItem.project_id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0, hasMentionFromHead: false, hasMentionFromClient: false, headName: "Head", clientName: "Client", monitorName: "Employee" };
                      return (
                        <div
                          key={index}
                          className={`flex relative justify-start items-start w-full ${isTechnicalDesktop ? "min-w-0" : "min-w-[700px]"} flex-col`}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full min-w-0">
                            <div className="flex items-start justify-between w-full min-w-0 gap-2">
                              <div className="flex gap-2 items-center justify-start min-w-0 flex-1">
                              <Button1
                                gradientType="gradient1"
                                width={widthClass}
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={projectItem.workstream}
                              />
                              <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className="font-mono ${textSize} font-bold text-slate-900 tracking-tight">
    {"ID:"+projectItem.project_id}
  </span>
</div>
</div>
<div className="flex items-center space-x-3 shrink-0">
  {/* Talk to Client/Head */}
  <div className="flex items-center">
    <div
      className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
                 bg-blue-600 text-xs font-medium text-white
                 transition-colors hover:bg-blue-500"
      style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
      onClick={() =>
        navigate(`/teamleaderprojectinfo`, { state: { item: projectItem } })
      }
    >
      Talk to Client/Head
    </div>
    {!dismissedNotifications.has(projectItem.project_id) &&
      !isQuietProjectStatus((projectItem as any).status) && (
      <UnreadDots
        showGreen={
          (unreadInfoForProject.unreadFromHead || 0) +
            (unreadInfoForProject.unreadFromClient || 0) >
          0
        }
        showBlue={
          unreadInfoForProject.hasMentionFromHead ||
          unreadInfoForProject.hasMentionFromClient
        }
        onDismiss={(e) => {
          e.stopPropagation();
          setDismissedNotifications((prev) =>
            new Set([...prev, projectItem.project_id])
          );
        }}
      />
    )}
  </div>

  {/* Talk to Employee */}
  <div className="flex items-center">
    <div
      className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
                 bg-slate-700 text-xs font-medium text-white
                 transition-colors hover:bg-slate-600"
      style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
      onClick={() =>
        navigate(`/teamleaderprojectinfo_withemployee`, {
          state: { item: projectItem },
        })
      }
    >
      Talk to Employee
    </div>
    {!dismissedNotifications.has(projectItem.project_id) &&
      !isQuietProjectStatus((projectItem as any).status) && (
      <UnreadDots
        showGreen={(unreadInfoForProject.unreadFromMonitor || 0) > 0}
        showBlue={false} // monitor currently has no mention flag
        onDismiss={(e) => {
          e.stopPropagation();
          setDismissedNotifications((prev) =>
            new Set([...prev, projectItem.project_id])
          );
        }}
      />
    )}
  </div>
</div>
                            </div>
                            <div className="border-t-2 border-[#000000] w-full"></div>
                          </div>
                          <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
                            <div
                              className={`text-[#000000] w-[35%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              {projectItem.title}
                            </div>
                           <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
>
  <div>
    Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })}
  </div>
  <ActiveSinceLabel
    activeDate={projectItem.active_date}
    status={projectItem.status}
  />
</div>
                            <div
                              className={`text-[#000000] w-[30%] font-normal ${textSize} -tracking-[0.02rem] justify-center flex items-center gap-1`}
                            >
                              {extraCount > 0 ? (
                                <>
                                  {firstEmployee}
                                  <span className="ml-1 px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-[11px]">
                                    +{extraCount}
                                  </span>
                                </>
                              ) : (
                                firstEmployee
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center  justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No On-Going projects found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters/move to Completed tab or not active by Sales Team </p>

                  </div>
                )
              ) : activeTab === "Verify Employee" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item) => {
                    const employeeItem = item as EmployeeRegRequest;
                    return (
                      <div
                        key={employeeItem.id}
                        className={`flex justify-start items-start w-full ${isTechnicalDesktop ? "min-w-0" : "min-w-[850px]"} flex-col`}
                      >
                        <div className="flex flex-col-reverse items-start justify-start w-full">
                          <div>
                            <Button1
                              width={getWidthClass(maxEmployeeRequestTextLength)}
                              gradientType="gradient1"
                              text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                              value={employeeItem.employeeName}
                            />
                          </div>
                          <div className="border-t-2 border-[#000000] w-full"></div>
                        </div>
                        <div className="flex mt-2 w-full pl-[2vw] justify-between items-center min-w-0 gap-2">
                          <div
                            className={`text-[#000000] w-[33.33%] min-w-0 break-words text-start flex font-normal ${textSize} -tracking-[0.02rem]`}
                          >
                            Employee ID: {employeeItem.employmentID}
                          </div>
                          <div
                            className={`text-[#000000] font-normal flex justify-start w-[33.33%] min-w-0 break-words ${textSize} -tracking-[0.02rem]`}
                          >
                            Email: {employeeItem.employeeMail}
                          </div>
                          <div className={`w-[33.33%] shrink-0 flex justify-center items-center`}>
                            <div className="flex items-center justify-center gap-2">
                              {employeeItem.status !== "pending" && (
                                <div
                                  className={`text-[#000000] ${employeeItem.status === "accepted"
                                      ? "rounded-full bg-[#A3FFA1] p-2"
                                      : "bg-[#FFB2A3] rounded-full p-2"
                                    } font-normal text-[12px] -tracking-[0.02rem]`}
                                >
                                  {employeeItem.status === "accepted" ? (
                                    <div className="flex gap-x-2 items-center font-semibold">
                                      Verified
                                      <FaCircleCheck size={15} color="#14EB0C" />
                                    </div>
                                  ) : (
                                    <div className="flex gap-x-2 items-center font-semibold">
                                      Rejected
                                      <IoCloseCircle size={20} color="#F5310A" />
                                    </div>
                                  )}
                                </div>
                              )}
                              {(employeeItem.status === "pending" || employeeItem.status === "rejected") && (
                                <div
                                  onClick={() => handleVerifyEmployee(employeeItem.id, employeeItem.status)}
                                  className={`bg-green-100 hover:bg-green-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center ${verifyingIds.has(employeeItem.id) ? "cursor-not-allowed opacity-70" : ""}`}
                                >
                                  <span className="text-green-500 font-semibold text-[12px]">
                                    {verifyingIds.has(employeeItem.id) ? "Verifying..." : employeeItem.status === "rejected" ? "Re-verify" : "Verify"}
                                  </span>
                                </div>
                              )}
                              {(employeeItem.status === "pending" || employeeItem.status === "accepted") && (
                                <div
                                  onClick={() => handleDeclineEmployee(employeeItem.id, employeeItem.status)}
                                  className={`bg-red-100 hover:bg-red-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center ${decliningIds.has(employeeItem.id) ? "cursor-not-allowed opacity-70" : ""}`}
                                >
                                  <span className="text-red-500 font-semibold text-[12px]">
                                    {decliningIds.has(employeeItem.id) ? "Declining..." : employeeItem.status === "accepted" ? "Block" : "Decline"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[#000000] text-[14px] font-normal mt-7">
                    No employee registrations found
                  </div>
                )
              ) : activeTab === "Completed" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item, index) => {
                    // Type guard: only render if item is ProjectListProps (not GroupedRequestProps or EmployeeRegRequest)
                    if (
                      typeof item === "object" &&
                      "workstream" in item &&
                      "title" in item &&
                      "clientName" in item &&
                      "project_id" in item &&
                      "deadline" in item &&
                      "description" in item
                    ) {
                      const projectItem = item as ProjectListProps;
                      return (
                        <div
                          key={index}
                          className={`flex relative justify-start items-start w-full ${isTechnicalDesktop ? "min-w-0" : "min-w-[700px]"} flex-col`}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full">
                            <div className="flex items-start justify-between w-full min-w-0 gap-2">
                              <div className="flex gap-2 items-center justify-start min-w-0 flex-1">
                              <Button1
                                width={widthClass}
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={projectItem.workstream}
                              />
                              <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className="font-mono ${textSize} font-bold text-slate-900 tracking-tight">
    {"ID:"+projectItem.project_id}
  </span>
</div>
</div>
                              <div className="flex items-center space-x-3 shrink-0">
                                <div
                                  className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
               bg-blue-600 text-xs font-medium text-white
               transition-colors hover:bg-blue-500"
                                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
                                  onClick={() => navigate(`/teamleaderprojectinfo`, { state: { item: projectItem } })}
                                >
                                  Talk to Client/Head
                                </div>

                                <div
                                  className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
               bg-slate-700 text-xs font-medium text-white
               transition-colors hover:bg-slate-600"
                                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
                                  onClick={() => navigate(`/teamleaderprojectinfo_withemployee`, { state: { item: projectItem } })}
                                >
                                  Talk to Employee
                                </div>
                              </div>
                            </div>
                            <div className="border-t-2 border-[#000000] w-full"></div>
                          </div>
                          <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
                            <div
                              className={`text-gray-600 w-[35%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              {projectItem.title}
                            </div>
                          <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
>
  <div>
    Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })}
  </div>
  <ActiveSinceLabel
    activeDate={projectItem.active_date}
    status={projectItem.status}
  />
</div>
                            <div
                              className={`text-gray-600 w-[30%] font-normal ${textSize} -tracking-[0.02rem]`}
                            >
                              {projectItem.clientName || "N/A"}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center  justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No completed projects found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

                  </div>
                )
              ) : (
                <div className={`mt-7 flex flex-col items-center  justify-center`}>
                  <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                    <MdFolderOff color="gray" size={40} />
                  </div>
                  <p className="text-gray-900 font-medium text-[15px]">No list items found</p>
                  <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

                </div>
              )
            ) : department === "Sales" ? (
              activeTab === "SOP List" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item: ProjectListProps | GroupedRequestProps | EmployeeRegRequest, index) => {
                    const projectItem = item as ProjectListProps;
                    // Type guard to ensure item has project_id before rendering
                    if (!("project_id" in item)) {
                      return null;
                    }
                    return (
                      <div
                        key={index}
                        className={`flex cursor-pointer relative justify-start items-start w-full min-w-[700px] flex-col`}
                        onClick={() => {  // Add this onClick handler for popup
                          setSelectedProject(projectItem);
                          setShowModal(true);
                        }}
                      >
                        <div className="flex flex-col-reverse items-start justify-start w-full">
                          <div className="flex items-start gap-2 w-full">
                            <Button1
                              width={widthClass}
                              gradientType="gradient1"
                              text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                              value={item.workstream}
                            />
                            <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className="font-mono ${textSize} font-bold text-slate-900 tracking-tight">
    {"ID:"+item.project_id}
  </span>
</div>
                          </div>
                          <div className="border-t-2 border-[#000000] w-full"></div>
                        </div>
                        <div className="flex mt-3 w-full pl-[2vw] justify-between items-center min-w-0 gap-4">
                          <div
                            className={`text-[#000000] w-[25%] min-w-0 break-words text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                              } -tracking-[0.02rem]`}
                          >
                            {item.title}
                          </div>
                         <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[25%] min-w-0 ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
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
    status={(item as any).project_status || (item as any).status}
  />
</div>
                          <div
                            className={`text-[#000000] w-[30%] min-w-0 break-words font-normal ${textSize} -tracking-[0.02rem]`}
                          >
                            {item.clientName || "N/A"}
                          </div>
                          <div className="flex w-[20%] shrink-0 items-center justify-end">
                            {loadingStatuses[projectItem.project_id] ? (
                              <div className="flex items-center space-x-2 text-slate-400 animate-pulse">
                                {/* <RiLoader2Fill className="w-4 h-4 animate-spin" /> */}
                                <span className="text-sm font-medium">Updating...</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                {/* Dynamic Status Badge */}
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${projectItem.status === "Active"
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-100 text-amber-700 border border-amber-200"
                                  }`}>
                                  {projectItem.status}
                                </span>

                                {/* Action Button */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextStatus = projectItem.status === "Hold" ? "Active" : "Hold";
                                    handleUpdateStatus(projectItem.project_id, nextStatus);
                                  }}
                                  title={projectItem.status === "Hold" ? "Activate Project" : "Put on Hold"}
                                  className={`
                    cursor-pointer relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300
                    ${projectItem.status === "Active" ? "bg-green-500" : "bg-gray-300"}
                  `}
                                >
                                  {/* Toggle knob */}
                                  <span
                                    className={`
                      inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                      ${projectItem.status === "Active" ? "translate-x-5" : "translate-x-1"}
                    `}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center  justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No projects found</p>

                  </div>
                )
              ) : activeTab === "Active" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item, index) => {
                    // Type guard: only render if item is ProjectListProps (not GroupedRequestProps or EmployeeRegRequest)
                    if (
                      typeof item === "object" &&
                      "workstream" in item &&
                      "title" in item &&
                      "clientName" in item &&
                      "project_id" in item &&
                      "deadline" in item &&
                      "description" in item
                    ) {
                      const projectItem = item as ProjectListProps;
                      return (
                        <div
                          key={index}
                          className={`flex cursor-pointer relative justify-start items-start w-full min-w-0 flex-col`}
                          onClick={() => {
                            setSelectedProject(projectItem);
                            setShowModal(true);
                          }}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full min-w-0">
                            <div className="flex items-center justify-between gap-3 w-full min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                              <Button1
                                width={widthClass}
                                gradientType="gradient1"
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={projectItem.workstream}
                              />
                              <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className={`font-mono ${textSize} font-bold text-slate-900 tracking-tight`}>
    {"ID:"+projectItem.project_id}
  </span>
</div>
                              </div>
                              {department === "Sales" && projectItem.status === "Active" && (
                                <Button2
                                  value="Update Progress"
                                  onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setSelectedProgressProject(projectItem);
                                    setShowProgressModal(true);
                                  }}
                                />
                              )}
                            </div>
                            <div className="border-t-2 border-[#000000] w-full"></div>
                          </div>
                          <div className="flex mt-3 w-full pl-[2vw] justify-between items-center min-w-0 gap-2">
                            <div
                              className={`text-[#000000] w-[20%] min-w-0 break-words text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              {projectItem.title}
                            </div>
                           <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] min-w-0 ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
>
  <div>
    Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })}
  </div>
  <ActiveSinceLabel
    activeDate={projectItem.active_date}
    status={projectItem.status}
  />
</div>
                            <div
                              className={`text-[#000000] w-[20%] min-w-0 break-words font-normal text-[12px] -tracking-[0.02rem]`}
                            >
                              {projectItem.clientName || "N/A"}
                            </div>
                            <div className="flex w-[30%] items-center justify-end">
                              {loadingStatuses[projectItem.project_id] ? (
                                <div className="flex items-center space-x-2 text-slate-400 animate-pulse">
                                  <RiLoader2Fill className="w-4 h-4 animate-spin" />
                                  <span className="text-sm font-medium">Updating...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-3">
                                  {/* Dynamic Status Badge */}
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${projectItem.status === "Completed"
                                      ? "bg-green-100 text-green-700 border border-green-200"
                                      : "bg-blue-100 text-blue-700 border border-blue-200"
                                    }`}>
                                    {projectItem.status === "Completed" ? "Completed" : "Active"}
                                  </span>

                                  {/* Action Button */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextStatus = projectItem.status === "Active" ? "Completed" : "Active";
                                      handleUpdateStatus(projectItem.project_id, nextStatus);
                                    }}
                                    title={projectItem.status === "Active" ? "Mark as Completed" : "Re-activate Project"}
                                    className={`
                        cursor-pointer relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300
                        ${projectItem.status === "Completed" ? "bg-green-500" : "bg-gray-300"}
                      `}
                                  >
                                    {/* Toggle knob */}
                                    <span
                                      className={`
                          inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                          ${projectItem.status === "Completed" ? "translate-x-5" : "translate-x-1"}
                        `}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center  justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No active projects found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters/move to On-Going tab or not active by Sales Team </p>

                  </div>
                )
              ) :
                activeTab === "Completed" ? (
                  filteredItems.length > 0 ? (
                    currentItems.map((item, index) => {
                      // Type guard: only render if item is ProjectListProps (not GroupedRequestProps or EmployeeRegRequest)
                      if (
                        typeof item === "object" &&
                        "workstream" in item &&
                        "title" in item &&
                        "clientName" in item &&
                        "project_id" in item &&
                        "deadline" in item &&
                        "description" in item
                      ) {
                        const projectItem = item as ProjectListProps;
                        return (
                          <div
                            key={index}
                            className={`flex relative justify-start items-start w-full min-w-[700px] flex-col`}
                          >
                            <div className="flex flex-col-reverse items-start justify-start w-full">
                              <div className="flex items-start gap-2 w-full">
                                <Button1
                                  width={widthClass}
                                  text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                  value={projectItem.workstream}
                                />
                                <div className="flex items-center gap-2  pl-2.5 py-0.5">
  <span className="font-mono ${textSize} font-bold text-slate-900 tracking-tight">
    {"ID:"+projectItem.project_id}
  </span>
</div>
                              </div>
                              <div className="border-t-2 border-[#000000] w-full"></div>
                            </div>
                            <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
                              <div
                                className={`text-gray-600 w-[25%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                                  } -tracking-[0.02rem]`}
                              >
                                {projectItem.title}
                              </div>
                            <div
  className={`text-[#000000] font-normal flex flex-col justify-center items-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
>
  <div>
    Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })}
  </div>
  <ActiveSinceLabel
    activeDate={projectItem.active_date}
    status={projectItem.status}
  />
</div>
                              <div
                                className={`text-gray-600 w-[30%] font-normal ${textSize} -tracking-[0.02rem]`}
                              >
                                {projectItem.clientName || "N/A"}
                              </div>
                              <div className="flex w-[20%] items-center justify-end">
                                {loadingStatuses[projectItem.project_id] ? (
                                  <div className="flex items-center space-x-2 text-slate-400 animate-pulse">
                                    <RiLoader2Fill className="w-4 h-4 animate-spin" />
                                    <span className="text-sm font-medium">Updating...</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    {/* Dynamic Status Badge */}
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${projectItem.status === "Completed"
                                        ? "bg-green-100 text-green-700 border border-green-200"
                                        : "bg-blue-100 text-blue-700 border border-blue-200"
                                      }`}>
                                      {projectItem.status === "Completed" ? "Completed" : "Active"}
                                    </span>

                                    {/* Action Button */}
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextStatus = projectItem.status === "Completed" ? "Active" : "Completed";
                                        handleUpdateStatus(projectItem.project_id, nextStatus);
                                      }}
                                      title={projectItem.status === "Completed" ? "Re-activate Project" : "Mark as Completed"}
                                      className={`
                        cursor-pointer relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300
                        ${projectItem.status === "Completed" ? "bg-green-500" : "bg-gray-300"}
                      `}
                                    >
                                      {/* Toggle knob */}
                                      <span
                                        className={`
                          inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                          ${projectItem.status === "Completed" ? "translate-x-5" : "translate-x-1"}
                        `}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })
                  ) : (
                    <div className={`mt-7 flex flex-col items-center  justify-center`}>
                      <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                        <MdFolderOff color="gray" size={40} />
                      </div>
                      <p className="text-gray-900 font-medium text-[15px]">No completed projects found</p>
                      <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

                    </div>
                  )
                ) : (
                  <div className={`mt-7 flex flex-col items-center  justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No list items found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

                  </div>
                )
            ) : (
              <div className={`mt-7 flex flex-col items-center  justify-center`}>
                <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                  <MdFolderOff color="gray" size={40} />
                </div>
                <p className="text-gray-900 font-medium text-[15px]">No list items found</p>
                <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

              </div>
            )}
          </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 w-full flex justify-center">
        <PaginationNav
          total={totalPages}
          current={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
      {showModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
            <div className="border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">Project Details</h2>
              <div
                onClick={() => setShowModal(false)}
                className="text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    {selectedProject.workstream}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900 leading-tight">
                    {selectedProject.title}
                  </h3>
                </div>
                <div className="col-span-1 border-l-2 border-slate-100 pl-4">
                  <p className="text-xs font-medium text-slate-500 uppercase">Client</p>
                  <p className="font-semibold text-slate-800">{selectedProject.clientName}</p>
                </div>
                <div className="col-span-1 border-l-2 border-slate-100 pl-4">
                  <p className="text-xs font-medium text-slate-500 uppercase">Project ID</p>
                  <p className="font-semibold text-slate-800">{selectedProject.project_id}</p>
                </div>
                <div className="col-span-2 flex items-center gap-4 py-3 px-4 bg-slate-50 rounded-lg">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-slate-500">Deadline</p>
                    <p className="font-bold text-slate-800">{new Date(selectedProject.deadline).toLocaleDateString()}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-slate-500">Budget</p>
                    <p className="font-bold text-green-600">{selectedProject.budget}</p>
                  </div>
                  {selectedProject.status && (
                    <>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="flex-1 text-center">
                        <p className="text-xs text-slate-500">Status</p>
                        <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase rounded bg-blue-100 text-blue-700">
                          {selectedProject.status}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="col-span-2 text-start">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">Description</p>
                  <p
                    className="text-slate-600 leading-relaxed text-sm"
                    dangerouslySetInnerHTML={{ __html: selectedProject.description[0] }}
                  />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3">
              <div
                onClick={() => setShowModal(false)}
                className="bg-blue-600 cursor-pointer hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
              >
                Close
              </div>
            </div>
          </div>
        </div>
      )}
      {showProgressModal && selectedProgressProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
            <div className="border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">Update Progress for {selectedProgressProject.title}</h2>
              <div
                onClick={() => setShowProgressModal(false)}
                className="text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="flex justify-center">
                <ProgressTracking
                  progress={progress}
                  onStepClick={department === 'Sales' ? handleStepClick : undefined}
                  updateType={department === 'Sales' ? 'payment' : undefined}
                />
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3">
              <div
                onClick={() => setShowProgressModal(false)}
                className="bg-blue-600 cursor-pointer hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
              >
                Close
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLeaderLanding;
