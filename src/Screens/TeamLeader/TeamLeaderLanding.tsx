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
import { MdCancel, MdFolderOff } from "react-icons/md";
import ProgressTracking from "../../UI_Components/Progresses/ProgressTracking";
import Button2 from "../../UI_Components/Buttons/Button2";

interface ProjectListProps {
  workstream: string;
  title: string;
  clientName: string;
  project_id: string;
  deadline: string;
  description: string;
  status?: string;
  budget?: number;
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
}

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
  const [totalUnreadOngoing, setTotalUnreadOngoing] = useState<number>(0);
  const [totalUnreadRequests, setTotalUnreadRequests] = useState<number>(0);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const itemsPerPage = 6;
  const navigate = useNavigate();
  const prevProjectDetailsRef = useRef<ProjectListProps[]>([]);
  const prevRequestsRef = useRef<RequestProps[]>([]);
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
      if (employeeRegResponse.status) {
        const sortedData = (employeeRegResponse.data as EmployeeRegRequest[]).sort((a, b) => {
          const statusOrder = { pending: 1, accepted: 2, rejected: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        });
        setEmployeeRegRequests((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(sortedData)) {
            return sortedData;
          }
          return prev;
        });
        if (error && error.includes("employee")) {
          setError(null);
        }
      } else {
        setError(employeeRegResponse.data?.message || "Failed to fetch employee registrations.");
      }
    } catch (err) {
      setError("Failed to fetch employee registrations. Please try again.");
      console.error("Fetch Employees Error:", err);
    }
  }, [error]);

useEffect(() => {
  const storedUserData = localStorage.getItem("userData");
  const parsedData = storedUserData ? JSON.parse(atob(storedUserData)) : null;

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
        emitEvent('joinTlMonitorRoom', projectId);
      });
    }

    return () => {
      allProjectIds.forEach((projectId) => {
        emitEvent('leaveProject', projectId);
      });
      if (department === "Technical") {
        ongoingProjectIds.forEach((projectId) => {
          emitEvent('leaveTlMonitorRoom', projectId);
        });
      }
    };
  }, [connected, allProjectIds, ongoingProjectIds, emitEvent, department]);

  // Fetch projects and unread message info (initial only, updates via socket)
  const fetchUnreadInfo = useCallback(async () => {
    const allProjects: ProjectListProps[] = projectDetails;
    setAllProjectIds(allProjects.map(p => p.project_id));

    const ongoingProjects: ProjectWithEmployees[] = Object.values(
      requests
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

          let unreadFromHead = 0;
          let unreadFromClient = 0;
          let hasMentionFromHead = false;
          let hasMentionFromClient = false;

          [...headChats, ...headAudios].forEach((chat: string) => {
            try {
              const parsed = JSON.parse(chat);
              if (!parsed.seen_by || !parsed.seen_by.includes("tl")) {
                unreadFromHead++;
                if (parsed.mention && parsed.mention.type === "tl") {
                  hasMentionFromHead = true;
                }
              }
            } catch {
              // Ignore parsing errors
            }
          });

          [...clientChats, ...clientAudios].forEach((chat: string) => {
            try {
              const parsed = JSON.parse(chat);
              if (!parsed.seen_by || !parsed.seen_by.includes("tl")) {
                unreadFromClient++;
                if (parsed.mention && parsed.mention.type === "tl") {
                  hasMentionFromClient = true;
                }
              }
            } catch {
              // Ignore parsing errors
            }
          });

          const tlMonitorResponse = await getData(`clientproject/get_tl_monitor_chats/${project.project_id}`);
          let unreadFromMonitor = 0;
          let monitorName = "Employee";
          if (tlMonitorResponse.status && tlMonitorResponse.data) {
            const monitorChats = tlMonitorResponse.data.monitorchats || [];
            const monitorAudios = tlMonitorResponse.data.monitoraudios || [];
            [...monitorChats, ...monitorAudios].forEach((chat: string) => {
              try {
                const parsed = JSON.parse(chat);
                if (!parsed.seen_by || !parsed.seen_by.includes("tl")) {
                  unreadFromMonitor++;
                }
              } catch {
                // Ignore parsing errors
              }
            });
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
          [...monitorChats, ...monitorAudios].forEach((chat: string) => {
            try {
              const parsed = JSON.parse(chat);
              if (!parsed.seen_by || !parsed.seen_by.includes("tl")) {
                unreadFromMonitor++;
              }
            } catch {
              // Ignore parsing errors
            }
          });
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
  }, [requests, projectDetails]);

  useEffect(() => {
    const requestedProjectIds = new Set(
      requests
        .filter((item) => ["pending", "accepted", "TLAssign"].includes(item.status || ""))
        .map((item) => '' + item.project_id)
    );
    const ongoingIds = new Set(
      requests
        .filter((item) => ["accepted", "TLAssign"].includes(item.status || ""))
        .map((item) => '' + item.project_id)
    );
    const pendingIds = new Set(
      requests
        .filter((item) => item.status === "pending")
        .map((item) => '' + item.project_id)
    );
    const activeIds = new Set(
      projectDetails
        .filter((p) => !requestedProjectIds.has('' + p.project_id))
        .map((p) => '' + p.project_id)
    );

    setTotalUnreadActive(
      Array.from(activeIds).reduce((sum, id) => {
        const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
        return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
      }, 0)
    );

    setTotalUnreadOngoing(
      Array.from(ongoingIds).reduce((sum, id) => {
        const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
        return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
      }, 0)
    );

    setTotalUnreadRequests(
      Array.from(pendingIds).reduce((sum, id) => {
        const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
        return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
      }, 0)
    );
  }, [unreadInfo, requests, projectDetails]);

  useEffect(() => {
    const requestedProjectIds = new Set(
      requests
        .filter((item) => ["pending", "accepted", "TLAssign"].includes(item.status || ""))
        .map((item) => '' + item.project_id)
    );

    // Completed projects → their unread count is forced to 0 everywhere
    const completedProjectIds = new Set(
      projectDetails
        .filter((item: ProjectListProps) => item.status === "Completed")
        .map((item: ProjectListProps) => String(item.project_id))
    );

    const ongoingIds = new Set(
      requests
        .filter((item) => ["accepted", "TLAssign"].includes(item.status || ""))
        .map((item) => '' + item.project_id)
        .filter((id) => !completedProjectIds.has(id))   // ← exclude completed
    );

    const pendingIds = new Set(
      requests
        .filter((item) => item.status === "pending")
        .map((item) => '' + item.project_id)
    );

    const activeIds = new Set(
      projectDetails
        .filter((p) =>
          p.status === "Active" &&                     // ← added status filter
          !requestedProjectIds.has('' + p.project_id)
        )
        .map((p) => '' + p.project_id)
    );

    setTotalUnreadActive(
      Array.from(activeIds).reduce((sum, id) => {
        const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
        return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
      }, 0)
    );

    setTotalUnreadOngoing(
      Array.from(ongoingIds).reduce((sum, id) => {
        const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
        return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
      }, 0)
    );

    setTotalUnreadRequests(
      Array.from(pendingIds).reduce((sum, id) => {
        const info = unreadInfo[id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0 };
        return sum + info.unreadFromHead + info.unreadFromClient + info.unreadFromMonitor;
      }, 0)
    );
  }, [unreadInfo, requests, projectDetails]);

  // Fetch projects and requests (initial only)
  const fetchProjectsAndRequests = useCallback(async () => {
    try {
      setError(null);

      const projectResponse = await getData("clientproject/show_all_clientsprojects");
      if (projectResponse.status) {
        const newData = projectResponse.data || [];
        if (JSON.stringify(prevProjectDetailsRef.current) !== JSON.stringify(newData)) {
          setProjectDetails(newData);
          prevProjectDetailsRef.current = newData;
          setAllProjectIds(newData.map((p: any) => p.project_id));
        }
      } else {
        setError(projectResponse.message || "Failed to fetch projects.");
      }

      if (department === "Technical") {
        const requestResponse = await getData("clientproject/employee_requests");
        if (requestResponse.status) {
          const newData = requestResponse.data || [];
          if (JSON.stringify(prevRequestsRef.current) !== JSON.stringify(newData)) {
            setRequests(newData);
            prevRequestsRef.current = newData;
          }
        } else {
          setError(requestResponse.message || "Failed to fetch requests.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data. Please try again.");
      console.error("Fetch Error:", err);
    }
  }, [department]);

  const fetchProjects = useCallback(async () => {
  const projectResponse = await getData("clientproject/show_all_clientsprojects");
  if (projectResponse.status) {
    const newData = projectResponse.data || [];
    if (JSON.stringify(prevProjectDetailsRef.current) !== JSON.stringify(newData)) {
      setProjectDetails(newData);
      prevProjectDetailsRef.current = newData;
      setAllProjectIds(newData.map((p: any) => p.project_id));
    }
  }
}, []);

// ADD this after the existing "Listen for project status updates" useEffect
useEffect(() => {
  const handleNewProject = () => {
    fetchProjects();
  };
  onEvent('newProjectCreated', handleNewProject);
  return () => {
    // Cleanup
  };
}, [onEvent, fetchProjects]);

  // Initial fetch
  useEffect(() => {
    if (department) {
      setLoading(true);
      fetchProjectsAndRequests().then(() => {
        if (department === "Technical") {
          fetchUnreadInfo();
          fetchEmployees();
        }
      }).finally(() => setLoading(false));
    }
  }, [department, fetchProjectsAndRequests, fetchUnreadInfo, fetchEmployees]);

  // Join rooms
  useEffect(() => {
    if (connected) {
      emitEvent('joinTlRoom', null);
    }
  }, [connected, emitEvent, department]);

  // Listen for new employee requests (for live updates in Requests tab)
  useEffect(() => {
    if (department !== "Technical") return;

    const handleNewEmployeeRequest = (data: RequestProps) => {
      console.log('Received newEmployeeRequest:', data);  // Debug log
      setRequests((prev) => {
        // Check if request already exists to avoid duplicates
        const exists = prev.some((req) => req.request_id === data.request_id);
        if (exists) {
          return prev;
        }
        // Add the new request (assuming it's pending)
        return [...prev, { ...data, status: data.status || 'pending' }];
      });
      // No need to refetch unreadInfo for new pending requests
    };

    onEvent('newEmployeeRequest', handleNewEmployeeRequest);

    return () => {
      // Cleanup
    };
  }, [onEvent, department]);

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

    onEvent('employeeRequestStatusUpdate', handleRequestStatusUpdate);

    return () => {
      // Cleanup
    };
  }, [onEvent, fetchUnreadInfo, department]);

  // Listen for new messages from project rooms (head, client)
  useEffect(() => {
    if (department !== "Technical") return;

    const handleNewMessage = (data: { fromRole: 'head' | 'client' | 'tl'; msg: any; projectId?: string }) => {
      console.log('Received newMessage:', data);  // Debug log
      if (!data.projectId || data.fromRole === 'tl') return;  // Ignore own messages

      setUnreadInfo((prev) => {
        const projectId = data.projectId!;
        const current = prev[projectId] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0, hasMentionFromHead: false, hasMentionFromClient: false, headName: "Head", clientName: "Client", monitorName: "Employee" };
        let updatedProject = { ...current };
        let isNewUnread = false;

        if (data.fromRole === 'head') {
          if (!data.msg.seen_by?.includes('tl')) {
            updatedProject.unreadFromHead++;
            isNewUnread = true;
            if (data.msg.mention?.type === 'tl') {
              updatedProject.hasMentionFromHead = true;
            }
          }
        } else if (data.fromRole === 'client') {
          if (!data.msg.seen_by?.includes('tl')) {
            updatedProject.unreadFromClient++;
            isNewUnread = true;
            if (data.msg.mention?.type === 'tl') {
              updatedProject.hasMentionFromClient = true;
            }
          }
        }

        const newInfo = { ...prev, [projectId]: updatedProject };

        if (isNewUnread) {
          playNotificationSound();
        }

        return newInfo;
      });
    };

    onEvent('newMessage', handleNewMessage);

    return () => {
      // Cleanup
    };
  }, [onEvent, department]);

  // Listen for new TL-Monitor messages (from monitor/employee)
  useEffect(() => {
    if (department !== "Technical") return;

    const handleNewTlMonitorMessage = (data: { fromRole: 'tl' | 'monitor'; msg: any; projectId?: string }) => {
      console.log('Received newTlMonitorMessage:', data);  // Debug log
      if (!data.projectId || data.fromRole === 'tl') return;  // Ignore own messages (process only 'monitor')

      setUnreadInfo((prev) => {
        const projectId = data.projectId!;
        const current = prev[projectId] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0, hasMentionFromHead: false, hasMentionFromClient: false, headName: "Head", clientName: "Client", monitorName: "Employee" };
        let updatedProject = { ...current };
        let isNewUnread = false;

        if (!data.msg.seen_by || !data.msg.seen_by.includes("tl")) {
          updatedProject.unreadFromMonitor++;
          isNewUnread = true;
        }

        const newInfo = { ...prev, [projectId]: updatedProject };

        if (isNewUnread) {
          playNotificationSound();
        }

        return newInfo;
      });
    };

    onEvent('newTLMonitorMessage', handleNewTlMonitorMessage);

    return () => {
      // Cleanup
    };
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

    onEvent('messageSeen', handleMessageSeen);

    return () => {
      // Cleanup
    };
  }, [onEvent, fetchUnreadInfo, department]);

  // Listen for TL-Monitor message seen
  useEffect(() => {
    if (department !== "Technical") return;

    const handleTlMonitorMessageSeen = (data: { fromTL: boolean; seen_by: string[]; timestamp?: string; projectId?: string }) => {
      if (!data.projectId) return;
      // Refetch unread for accuracy
      fetchUnreadInfo();
    };

    onEvent('tlMonitorMessageSeen', handleTlMonitorMessageSeen);

    return () => {
      // Cleanup
    };
  }, [onEvent, fetchUnreadInfo, department]);

  // Listen for employee registration updates
  useEffect(() => {
    if (department !== "Technical") return;

    const handleEmployeeRegUpdate = (data: { id: string; status: 'pending' | 'accepted' | 'rejected' }) => {
      setEmployeeRegRequests((prev) =>
        prev
          .map((item) =>
            item.id === data.id ? { ...item, status: data.status } : item
          )
          .sort((a, b) => {
            const statusOrder = { pending: 1, accepted: 2, rejected: 3 };
            return statusOrder[a.status] - statusOrder[b.status];
          })
      );
    };

    onEvent('employeeRegUpdate', handleEmployeeRegUpdate);

    return () => {
      // Cleanup
    };
  }, [onEvent, department]);

  // Listen for project status updates
  useEffect(() => {
    const handleProjectStatusUpdate = (data: { projectId: string; status: string }) => {
      setProjectDetails((prev) =>
        prev.map((p) =>
          p.project_id === data.projectId ? { ...p, status: data.status } : p
        )
      );
    };

    onEvent('projectStatusUpdate', handleProjectStatusUpdate);

    return () => {
      // Cleanup
    };
  }, [onEvent]);

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
        const savedTabs = ["Active", "Requests", "On-Going", "Completed", "Verify Employee"];
        setTabs(savedTabs);
        const saved = localStorage.getItem("tlLandingActiveTab");
        setActiveTab(saved && savedTabs.includes(saved) ? saved : "Requests");
      }
    }
  }, [department]);

  const handleVerifyEmployee = async (requestId: string) => {
    if (verifyingIds.has(requestId)) return;

    setVerifyingIds((prev) => new Set([...prev, requestId]));

    try {
      const response = await postData(`employees/admin/accept_employee_request/${requestId}`, {});
      if (response.status) {
        setEmployeeRegRequests((prev) =>
          prev
            .map((item) =>
              item.id === requestId ? { ...item, status: 'accepted' as 'accepted' } : item
            )
            .sort((a, b) => {
              const statusOrder = { pending: 1, accepted: 2, rejected: 3 };
              return statusOrder[a.status] - statusOrder[b.status];
            })
        );
      } else {
        setError(response.message || "Failed to verify employee.");
      }
    } catch (err) {
      setError("Failed to verify employee. Please try again.");
      console.error("Verify Error:", err);
    } finally {
      setVerifyingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleDeclineEmployee = async (requestId: string) => {
    if (decliningIds.has(requestId)) return;

    setDecliningIds((prev) => new Set([...prev, requestId]));

    try {
      const response = await postData(`employees/admin/reject_employee_request/${requestId}`, {});
      if (response.status) {
        setEmployeeRegRequests((prev) =>
          prev
            .map((item) =>
              item.id === requestId ? { ...item, status: 'rejected' as 'rejected' } : item
            )
            .sort((a, b) => {
              const statusOrder = { pending: 1, accepted: 2, rejected: 3 };
              return statusOrder[a.status] - statusOrder[b.status];
            })
        );
      } else {
        setError(response.message || "Failed to decline employee.");
      }
    } catch (err) {
      setError("Failed to decline employee. Please try again.");
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
  );

  const completedProjectIds = new Set(
    projectDetails
      .filter((item: ProjectListProps) => item.status === "Completed")
      .map((item: ProjectListProps) => String(item.project_id))
  );

  const filteredItems =
    department === "Technical"
      ? activeTab === "Active"
        ? projectDetails.filter(
          (item: ProjectListProps) =>
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
        : activeTab === "Requests"
          ? Object.values(groupedPendingRequests).filter((item: GroupedRequestProps) =>
            (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.project_id.toString().includes(searchQuery) ||
              item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.employees.some(emp => emp.name.toLowerCase().includes(searchQuery.toLowerCase()))) &&
            (selectedFilters.length === 0 ||
              selectedFilters.some((filter) =>
                filter.toLowerCase().includes(item.workstream.toLowerCase())
              ))
          )
          : activeTab === "On-Going"
            ? Object.values(groupedOngoingRequests).filter((item: GroupedRequestProps) =>
              // NEW: Exclude any project that has "Completed" status (mirroring the Active tab logic)
              !completedProjectIds.has(String(item.project_id)) &&
              (item.workstream.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.project_id.toString().includes(searchQuery) ||
                item.deadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.employees.some(emp => emp.name.toLowerCase().includes(searchQuery.toLowerCase()))) &&
              (selectedFilters.length === 0 ||
                selectedFilters.some((filter) =>
                  filter.toLowerCase().includes(item.workstream.toLowerCase())
                ))
            ).map((item: GroupedRequestProps) => ({
              ...item,
              assignedEmployees: item.employees.map(emp => emp.name).join(", ")
            }) as ProjectWithEmployees)
            : activeTab === "Completed"
              ? projectDetails.filter(
                (item: ProjectListProps) =>
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
          ? projectDetails.filter(
            (item: ProjectListProps) =>
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
            ? projectDetails.filter(
              (item: ProjectListProps) =>
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
              ? projectDetails.filter(
                (item: ProjectListProps) =>
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
  const textSize = is2XL ? "text-[15px]" : "text-[12px]";

  const handleRequestTab = (item: GroupedRequestProps) => {
    navigate("/teamleaderprojectass", {
      state: {
        selectedRequest: item,
      },
    });
  };

  const playNotificationSound = () => {
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/01/18/audio_d3fd80e4d7.mp3');
    audio.play().catch(err => console.error("Error playing notification sound:", err));
  };

  if (loading) {
    return <PageLoadingComponent />;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }
  /* Helper components for icons (place these outside your render) */
  const IconAt = () => (
    <svg
      className="w-4 h-4 text-blue-600 flex-shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25"
      />
    </svg>
  );

  const IconChat = () => (
    <svg
      className="w-4 h-4 text-gray-600 flex-shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.04 8.25-6.75 8.25a9.75 9.75 0 01-6.75-3.032m0 0A9.753 9.753 0 013 12c0-4.556 3.04-8.25 6.75-8.25a9.75 9.75 0 016.75 3.032m0 0A9.753 9.753 0 0121 12z"
      />
    </svg>
  );

  const handleUpdateStatus = async (projectId: string, newStatus: string) => {
    const confirmed = confirm(`Are you sure you want to change the project status to ${newStatus}?`);
    if (!confirmed) return;

    try {
      const loadingText = newStatus === 'Active' ? 'Activating' : newStatus === 'Hold' ? 'Holding' : 'Completing';
      setLoadingStatuses((prev) => ({ ...prev, [projectId]: loadingText }));

      const response = await postData(`clientproject/update_project_status/${projectId}`, { status: newStatus });

      if (response.status) {
        setProjectDetails((prev) =>
          prev.map((p) => (p.project_id === projectId ? { ...p, status: newStatus } : p))
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
        className={`flex ${isXXS || isXS || isSM || isMD
            ? "w-full justify-center items-center space-x-[10vw]"
            : "w-full items-center justify-center"
          }`}
      >
        {(isXXS || isXS || isSM || isMD) && (
          <div>
            <TbFilterBolt size={25} onClick={() => setShowFilter(true)} />
          </div>
        )}
        <div className={`${isXXS || isXS || isSM || isMD ? "w-fit" : "w-fit"}`}>
          <MainSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        </div>
      </div>
      <div className={`flex w-full gap-x-5 items-start shrink-0 flex-row`}>
        {isXXS || isXS || isSM || isMD ? (
          renderDrawer && (
            <div
              className={`
                fixed top-9 left-0 w-[280px] z-5 bg-blue-50 p-4 rounded-br-[10px]
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
          <div className="w-[25%] mt-2">
            <Filter
              filters={activeTab === "Verify Employee" ? statusFilterOptions : filters}
              setSelectedFilters={activeTab === "Verify Employee" ? setStatusFilters : setSelectedFilters}
              setClose={setShowFilter}
            />
          </div>
        )}
        <div
          className={`flex flex-col ${isXXS || isXS || isSM || isMD ? "w-full" : "w-[75%]"
            }`}
        >
          <div
            className={`items-center flex  ${isXXS || isXS || isSM || isMD ? "w-full" : "justify-start w-full"
              }`}
          >
            <div className={`w-full ${isXXS || isXS || isSM || isMD || department === "Technical" ? "" : "mr-[29%]"}`}>
              <Navigation1
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  localStorage.setItem("tlLandingActiveTab", tab);
                }}
                totalUnreadActive={totalUnreadActive}
                totalUnreadOngoing={totalUnreadOngoing}
                totalUnreadRequests={totalUnreadRequests}
              />          </div>
          </div>
          <div className="overflow-x-auto">
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
                          className={`flex cursor-pointer justify-start items-start ${index === currentItems.length - 1 ? "mt-7" : "my-7"
                            } w-full min-w-[700px] flex-col`}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full">
                            <div>
                              <Button1
                                width={widthClass}
                                gradientType="gradient1"
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={item.workstream}
                              />
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
                              className={`text-[#000000] font-normal flex justify-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                             Submission Date: {new Date(item.deadline).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})}
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
                  <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
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
                    const hasAnyUnreadOrMention =
                      unreadInfoForProject.unreadFromHead > 0 ||
                      unreadInfoForProject.unreadFromClient > 0 ||
                      unreadInfoForProject.unreadFromMonitor > 0 ||
                      unreadInfoForProject.hasMentionFromHead ||
                      unreadInfoForProject.hasMentionFromClient;
                    return (
                      <div
                        key={index}
                        className={`flex relative ${hasAnyUnreadOrMention ? "pb-10" : ""} justify-start items-start ${index === currentItems.length - 1 ? "mt-7" : "my-7"
                          } w-full min-w-[700px] flex-col`}
                      >
                        <div className="flex flex-col-reverse items-start justify-start w-full">
                          <div className="flex items-start justify-between w-full">
                            <Button1
                              width={widthClass}
                              gradientType="gradient1"
                              text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                              value={item.workstream}
                            />
                            <div className="flex items-center space-x-3">
                              {/* Chevron Tag */}
                              <div
                                className="relative flex h-[28px] w-[160px] cursor-pointer items-center justify-center
                                   bg-blue-600 text-xs font-medium text-white
                                   transition-colors hover:bg-blue-500"
                                style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)' }}
                                onClick={() => navigate(`/teamleaderprojectinfo`, { state: { item } })}
                              >
                                Talk to Client/Head
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
                            {item.title}
                          </div>
                          <div
                            className={`text-[#000000] font-normal flex justify-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"
                              } -tracking-[0.02rem]`}
                          >
                           Submission Date: {new Date(item.deadline).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})}
                          </div>
                          <div
                            className={`text-[#000000]  w-[30%] font-normal text-[12px] -tracking-[0.02rem]`}
                          >
                            {item.clientName || "N/A"}
                          </div>
                        </div>
                        {(() => {
                          const totalUnread =
                            (unreadInfoForProject.unreadFromHead || 0) +
                            (unreadInfoForProject.unreadFromClient || 0) +
                            (unreadInfoForProject.unreadFromMonitor || 0);

                          // Only render the component if there is something to show
                          if (totalUnread === 0) {
                            return null;
                          }

                          return (
                            <>
                            {hasAnyUnreadOrMention && 
 !dismissedNotifications.has(projectItem.project_id) && (
                            <div className="absolute right-0 top-7 w-fit mt-2 z-50">
                              {/* Notification Container */}
                              <div className="relative bg-blue-50 border border-blue-200 rounded-lg p-3 pr-8 shadow-md">

                                {/* Pointer Triangle (perfectly at top-left corner) */}
                                <div className="absolute -top-[7px] left-[8px] w-0 h-0 border-l-[7px] border-r-[7px] border-b-[8px] border-l-transparent border-r-transparent border-b-blue-200"></div>
                                <div className="absolute -top-[6px] left-[9px] w-0 h-0 border-l-[6px] border-r-[6px] border-b-[7px] border-l-transparent border-r-transparent border-b-blue-50"></div>
<MdCancel
        size={22}
        onClick={(e) => {
          e.stopPropagation();
          setDismissedNotifications((prev) => new Set([...prev, projectItem.project_id]));
        }}
        className="absolute top-1.5 right-1 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-full p-0.5 transition-all duration-200 cursor-pointer"
      />
                                {/* Inner content */}
                                <div className="flex items-start space-x-3">
                                  {/* Badge */}
                                  <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 text-sm font-bold text-white bg-green-500 rounded-full">
                                    {totalUnread}
                                  </span>

                                  {/* Content */}
                                  <div className="flex flex-col space-y-1.5">
                                    {unreadInfoForProject.hasMentionFromHead && (
                                      <div className="flex items-center space-x-1.5">
                                        <IconAt />
                                        <span className="text-xs text-blue-700 font-medium">
                                          Head tagged you.
                                        </span>
                                      </div>
                                    )}

                                    {unreadInfoForProject.hasMentionFromClient && (
                                      <div className="flex items-center space-x-1.5">
                                        <IconAt />
                                        <span className="text-xs text-blue-700 font-medium">
                                          Client tagged you.
                                        </span>
                                      </div>
                                    )}

                                    {unreadInfoForProject.unreadFromHead > 0 && !unreadInfoForProject.hasMentionFromHead && (
                                      <div className="flex items-center space-x-1.5">
                                        <IconChat />
                                        <span className="text-xs text-gray-700">
                                          New message{unreadInfoForProject.unreadFromHead > 1 ? 's' : ''} from Head ({unreadInfoForProject.headName})
                                        </span>
                                      </div>
                                    )}

                                    {unreadInfoForProject.unreadFromClient > 0 && !unreadInfoForProject.hasMentionFromClient && (
                                      <div className="flex items-center space-x-1.5">
                                        <IconChat />
                                        <span className="text-xs text-gray-700">
                                          New message{unreadInfoForProject.unreadFromClient > 1 ? 's' : ''} from Client ({unreadInfoForProject.clientName})
                                        </span>
                                      </div>
                                    )}

                                    {unreadInfoForProject.unreadFromMonitor > 0 && (
                                      <div className="flex items-center space-x-1.5">
                                        <IconChat />
                                        <span className="text-xs text-gray-700">
                                          New message{unreadInfoForProject.unreadFromMonitor > 1 ? 's' : ''} from Employee ({unreadInfoForProject.monitorName})
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>)}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No active projects found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters/move to On-Going tab or not active by Sales Team </p>

                  </div>
                )
              ) : activeTab === "On-Going" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item, index) => {
                    if ("assignedEmployees" in item) {
                      const projectItem = item as ProjectWithEmployees;
                      const employeeNames = projectItem.assignedEmployees?.split(", ") || [];
                      const firstEmployee = employeeNames[0] || "N/A";
                      const extraCount = employeeNames.length - 1;
                      const unreadInfoForProject = unreadInfo[projectItem.project_id] || { unreadFromHead: 0, unreadFromClient: 0, unreadFromMonitor: 0, hasMentionFromHead: false, hasMentionFromClient: false, headName: "Head", clientName: "Client", monitorName: "Employee" };
                      const hasAnyUnreadOrMention =
                        unreadInfoForProject.unreadFromHead ||
                        unreadInfoForProject.unreadFromClient ||
                        unreadInfoForProject.unreadFromMonitor ||
                        unreadInfoForProject.hasMentionFromHead ||
                        unreadInfoForProject.hasMentionFromClient
                      return (
                        <div
                          key={index}
                          className={`flex relative ${!hasAnyUnreadOrMention ? "" : "pb-22"}  justify-start items-start ${index === currentItems.length - 1 ? "mt-7" : "my-7"
                            } w-full min-w-[700px] flex-col`}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full">
                            <div className="flex items-start justify-between w-full">
                              <Button1
                                gradientType="gradient1"
                                width={widthClass}
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={projectItem.workstream}
                              />
                              <div className="flex items-center space-x-3">
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
                              className={`text-[#000000] w-[35%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              {projectItem.title}
                            </div>
                            <div
                              className={`text-[#000000] font-normal flex justify-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})}
                            </div>
                            <div
                              className={`text-[#000000] w-[30%] font-normal text-[12px] -tracking-[0.02rem] justify-center flex items-center gap-1`}
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
                          {(() => {
                            const totalUnread =
                              (unreadInfoForProject.unreadFromHead || 0) +
                              (unreadInfoForProject.unreadFromClient || 0) +
                              (unreadInfoForProject.unreadFromMonitor || 0);

                            // Only render the component if there is something to show
                            if (totalUnread === 0) {
                              return null;
                            }

                            return (
                              <>
                              {hasAnyUnreadOrMention && 
 !dismissedNotifications.has(projectItem.project_id) && (
                              <div className="absolute right-5 top-15 w-fit mt-2 z-50">
                                {/* Notification Container */}
                                <div className="relative bg-blue-50 border border-blue-200 rounded-lg p-3 pr-8 shadow-md">

                                  {/* Pointer Triangle (perfectly at top-left corner) */}
                                  <div className="absolute -top-[7px] left-[8px] w-0 h-0 border-l-[7px] border-r-[7px] border-b-[8px] border-l-transparent border-r-transparent border-b-blue-200"></div>
                                  <div className="absolute -top-[6px] left-[9px] w-0 h-0 border-l-[6px] border-r-[6px] border-b-[7px] border-l-transparent border-r-transparent border-b-blue-50"></div>
<MdCancel
        size={22}
        onClick={(e) => {
          e.stopPropagation();
          setDismissedNotifications((prev) => new Set([...prev, projectItem.project_id]));
        }}
        className="absolute top-1.5 right-1 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-full p-0.5 transition-all duration-200 cursor-pointer"
      />
                                  {/* Inner content */}
                                  <div className="flex items-start space-x-3">
                                    {/* Badge */}
                                    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 text-sm font-bold text-white bg-green-500 rounded-full">
                                      {totalUnread}
                                    </span>

                                    {/* Content */}
                                    <div className="flex flex-col space-y-1.5">
                                      {unreadInfoForProject.hasMentionFromHead && (
                                        <div className="flex items-center space-x-1.5">
                                          <IconAt />
                                          <span className="text-xs text-blue-700 font-medium">
                                            Head tagged you.
                                          </span>
                                        </div>
                                      )}

                                      {unreadInfoForProject.hasMentionFromClient && (
                                        <div className="flex items-center space-x-1.5">
                                          <IconAt />
                                          <span className="text-xs text-blue-700 font-medium">
                                            Client tagged you.
                                          </span>
                                        </div>
                                      )}

                                      {unreadInfoForProject.unreadFromHead > 0 && !unreadInfoForProject.hasMentionFromHead && (
                                        <div className="flex items-center space-x-1.5">
                                          <IconChat />
                                          <span className="text-xs text-gray-700">
                                            New message{unreadInfoForProject.unreadFromHead > 1 ? 's' : ''} from Head ({unreadInfoForProject.headName})
                                          </span>
                                        </div>
                                      )}

                                      {unreadInfoForProject.unreadFromClient > 0 && !unreadInfoForProject.hasMentionFromClient && (
                                        <div className="flex items-center space-x-1.5">
                                          <IconChat />
                                          <span className="text-xs text-gray-700">
                                            New message{unreadInfoForProject.unreadFromClient > 1 ? 's' : ''} from Client ({unreadInfoForProject.clientName})
                                          </span>
                                        </div>
                                      )}

                                      {unreadInfoForProject.unreadFromMonitor > 0 && (
                                        <div className="flex items-center space-x-1.5">
                                          <IconChat />
                                          <span className="text-xs text-gray-700">
                                            New message{unreadInfoForProject.unreadFromMonitor > 1 ? 's' : ''} from Employee ({unreadInfoForProject.monitorName})
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>)}
                              </>

                            );
                          })()}
                        </div>
                      );
                    }
                    return null;
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No On-Going projects found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters/move to Completed tab or not active by Sales Team </p>

                  </div>
                )
              ) : activeTab === "Verify Employee" ? (
                filteredItems.length > 0 ? (
                  currentItems.map((item, index) => {
                    const employeeItem = item as EmployeeRegRequest;
                    return (
                      <div
                        key={employeeItem.id}
                        className={`flex justify-start items-start ${index === currentItems.length - 1 ? "my-7" : "my-7"
                          } w-full min-w-[850px] flex-col`}
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
                        <div className="flex mt-2 w-full pl-[2vw] justify-between items-center">
                          <div
                            className={`text-[#000000] w-[33.33%] text-start flex font-normal ${textSize} -tracking-[0.02rem]`}
                          >
                            Employee ID: {employeeItem.employmentID}
                          </div>
                          <div
                            className={`text-[#000000] font-normal flex justify-start w-[33.33%] ${textSize} -tracking-[0.02rem]`}
                          >
                            Email: {employeeItem.employeeMail}
                          </div>
                          <div className={`w-[33.33%] flex justify-center items-center`}>
                            {employeeItem.status === "pending" ? (
                              <div className="flex space-x-2">
                                {/* Verify Button */}
                                <div
                                  onClick={() => handleVerifyEmployee(employeeItem.id)}
                                  className={`bg-green-100 hover:bg-green-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center ${verifyingIds.has(employeeItem.id) ? "cursor-not-allowed opacity-70" : ""
                                    }`}
                                >
                                  <span className="text-green-500 font-semibold text-[12px]">
                                    {verifyingIds.has(employeeItem.id) ? "Verifying..." : "Verify"}
                                  </span>
                                </div>

                                {/* Decline Button */}
                                <div
                                  onClick={() => handleDeclineEmployee(employeeItem.id)}
                                  className={`bg-red-100 hover:bg-red-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center ${decliningIds.has(employeeItem.id) ? "cursor-not-allowed opacity-70" : ""
                                    }`}
                                >
                                  <span className="text-red-500 font-semibold text-[12px]">
                                    {decliningIds.has(employeeItem.id) ? "Declining..." : "Decline"}
                                  </span>
                                </div>
                              </div>
                            ) : (
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
                          className={`flex relative justify-start items-start ${index === currentItems.length - 1 ? "mt-7" : "my-7"
                            } w-full min-w-[700px] flex-col`}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full">
                            <div className="flex items-start justify-between w-full">
                              <Button1
                                width={widthClass}
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={projectItem.workstream}
                              />
                              <div className="flex items-center space-x-3">
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
                              className={`text-gray-600 font-normal flex justify-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})}
                            </div>
                            <div
                              className={`text-gray-600 w-[30%] font-normal text-[12px] -tracking-[0.02rem]`}
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
                  <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No completed projects found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

                  </div>
                )
              ) : (
                <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
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
                        className={`flex cursor-pointer relative justify-start items-start ${index === currentItems.length - 1 ? "mt-7" : "my-7"
                          } w-full min-w-[700px] flex-col`}
                        onClick={() => {  // Add this onClick handler for popup
                          setSelectedProject(projectItem);
                          setShowModal(true);
                        }}
                      >
                        <div className="flex flex-col-reverse items-start justify-start w-full">
                          <div className="flex items-start justify-between w-full">
                            <Button1
                              width={widthClass}
                              gradientType="gradient1"
                              text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                              value={item.workstream}
                            />
                          </div>
                          <div className="border-t-2 border-[#000000] w-full"></div>
                        </div>
                        <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
                          <div
                            className={`text-[#000000] w-[25%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                              } -tracking-[0.02rem]`}
                          >
                            {item.title}
                          </div>
                          <div
                            className={`text-[#000000] font-normal flex justify-center w-[25%] ${is2XL ? "text-[15px]" : "text-[12px]"
                              } -tracking-[0.02rem]`}
                          >
                            Submission Date: {new Date(item.deadline).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})}
                          </div>
                          <div
                            className={`text-[#000000] w-[30%] font-normal text-[12px] -tracking-[0.02rem]`}
                          >
                            {item.clientName || "N/A"}
                          </div>
                          <div className="flex w-[20%] items-center justify-end">
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
                  <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
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
                          className={`flex cursor-pointer relative justify-start items-start ${index === currentItems.length - 1 ? "mt-7" : "my-7"
                            } w-full min-w-[700px] flex-col`}
                          onClick={() => {
                            setSelectedProject(projectItem);
                            setShowModal(true);
                          }}
                        >
                          <div className="flex flex-col-reverse items-start justify-start w-full">
                            <div className="flex items-start justify-between w-full">
                              <Button1
                                width={widthClass}
                                gradientType="gradient1"
                                text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                value={projectItem.workstream}
                              />
                            </div>
                            <div className="border-t-2 border-[#000000] w-full"></div>
                          </div>
                          <div className="flex mt-3 w-full pl-[2vw] justify-between items-center">
                            <div
                              className={`text-[#000000] w-[20%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              {projectItem.title}
                            </div>
                            <div
                              className={`text-[#000000] font-normal flex justify-center w-[30%] ${is2XL ? "text-[15px]" : "text-[12px]"
                                } -tracking-[0.02rem]`}
                            >
                              Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric"
                              })}
                            </div>
                            <div
                              className={`text-[#000000] w-[20%] font-normal text-[12px] -tracking-[0.02rem]`}
                            >
                              {projectItem.clientName || "N/A"}
                            </div>
                            <div className="flex w-[30%] items-center justify-between">
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
                              {department === 'Sales' && projectItem.status === "Active" && (
                                <Button2
                                  value="Update Progress"
                                  onClick={(e: any) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setSelectedProgressProject(projectItem);
                                    setShowProgressModal(true);
                                  }}
                                />

                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                ) : (
                  <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
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
                            className={`flex relative justify-start items-start ${index === currentItems.length - 1 ? "mt-7" : "my-7"
                              } w-full min-w-[700px] flex-col`}
                          >
                            <div className="flex flex-col-reverse items-start justify-start w-full">
                              <div className="flex items-start justify-between w-full">
                                <Button1
                                  width={widthClass}
                                  text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                                  value={projectItem.workstream}
                                />
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
                                className={`text-gray-600 font-normal flex justify-center w-[25%] ${is2XL ? "text-[15px]" : "text-[12px]"
                                  } -tracking-[0.02rem]`}
                              >
                                Submission Date: {new Date(projectItem.deadline).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})}
                              </div>
                              <div
                                className={`text-gray-600 w-[30%] font-normal text-[12px] -tracking-[0.02rem]`}
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
                    <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
                      <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                        <MdFolderOff color="gray" size={40} />
                      </div>
                      <p className="text-gray-900 font-medium text-[15px]">No completed projects found</p>
                      <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

                    </div>
                  )
                ) : (
                  <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
                    <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                      <MdFolderOff color="gray" size={40} />
                    </div>
                    <p className="text-gray-900 font-medium text-[15px]">No list items found</p>
                    <p className="text-gray-500 text-[13px] mt-1 mb-5">Check the filters or another tabs </p>

                  </div>
                )
            ) : (
              <div className={`mt-7 flex flex-col items-center ${isXXS || isXS || isSM || isMD ? "" : "mr-[22%]"} justify-center`}>
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
      <div className="mt-8">
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