import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import MainSearchBar from "../../UI_Components/SearchBars/MainSearchBar";
import Filter from "../../UI_Components/Filter/Filter";
import Button1 from "../../UI_Components/Buttons/Button1";
import PaginationNav from "../../UI_Components/Navigations/PaginationNav";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import { TbFilterBolt } from "react-icons/tb";
import { FaTrash, FaUsers } from "react-icons/fa";
import { IoKeyOutline } from "react-icons/io5";
import CircularProgress from "../../UI_Components/Progresses/CircularProgress";
import { useNavigate } from "react-router-dom";
import { getData, postData } from "../../BackendConnections/FetchBackendServices";
import Navigation1 from "../../UI_Components/Navigations/Navigation1";
import DeleteConfirm from "../../UI_Components/Pop_Ups/DeleteConfirm";
import EditConfirm from "../../UI_Components/Pop_Ups/EditConfirm";
import { MdEdit } from "react-icons/md";
import PageLoadingComponent from "../../UI_Components/Pop_Ups/PageLoadingComponent";
import { FaCircleCheck, FaRegFolder } from "react-icons/fa6";
import { IoCloseCircle } from "react-icons/io5";
import AllEmployeeList from "../Employees/AllEmployeeList";
import { useSocket } from "../../BackendConnections/useSocket";
import { isQuietProjectStatus, playChatNotificationSound, unlockChatNotificationSound } from "../../utils/chatLive";
import { readStoredUserData } from "../../utils/authStorage";
// import { useGlobalPush } from "../../hooks/useGlobalPush";
interface Project {
  title: string;
  workstream: string;
  clientName: string;
  project_id: string;
  deadline: string;
  budget: number;
  description: string;
  unreadFromClient: number;
  unreadFromTL: number;
  hasMentionFromClient: boolean;
  hasMentionFromTL: boolean;
  teamLeaderName: string;
  status: string; // Add this
  progress: number;
  active_date?: string | null;
}
interface ClientListProps {
  key_id: string;
  name: string;
  email: string;
  mobile: string;
  created_at?: string;
}
interface TeamLeaderListProps extends ClientListProps {}
interface EmployeeRegRequest {
  id: string;
  employeeName: string;
  employeeMail: string;
  employmentID: string;
  employeeDesignation: string;
  gender: string;
  role: "Employee" | "Team Leader";
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
}
interface SecurityKey extends ClientListProps {
  type: "client" | "teamLeader";
}

const getDateTime = (value?: string | number | null) => {
  if (value == null || value === "") return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const sortByLatestDate = <T extends { created_at?: string; id?: string; key_id?: string }>(a: T, b: T) => {
  const aTime = getDateTime(a.created_at);
  const bTime = getDateTime(b.created_at);
  if (aTime !== bTime) return bTime - aTime;

  // Registrations use `id`, while security keys use `key_id`.
  // This makes the order deterministic when creation timestamps are equal.
  const aId = Number(a.id ?? a.key_id);
  const bId = Number(b.id ?? b.key_id);
  if (!Number.isNaN(aId) && !Number.isNaN(bId) && (aId || bId)) return bId - aId;
  return String(b.key_id ?? b.id ?? "").localeCompare(String(a.key_id ?? a.id ?? ""));
};
const HeadProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"client" | "teamLeader" | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(["IT"]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [keyFilter, setKeyFilter] = useState("All");
  const [showFilter, setShowFilter] = useState(false);
  const [renderDrawer, setRenderDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [projectDetails, setProjectDetails] = useState<Project[]>([]);
  const [clientDetails, setClientDetails] = useState<ClientListProps[]>([]);
  const [teamLeaderDetails, setTeamLeaderDetails] = useState<TeamLeaderListProps[]>([]);
  const [employeeRegRequests, setEmployeeRegRequests] = useState<EmployeeRegRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<SecurityKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMail, setSelectedMail] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<string>(() => {
  return localStorage.getItem("headProjectListActiveTab") || "All Projects";
});
  const [width, setWidth] = useState(window.innerWidth);
  const [totalUnread, setTotalUnread] = useState<number>(0);
  const [projectStartDate, setProjectStartDate] = useState<string>("2024");
  const [projectEndDate, setProjectEndDate] = useState<string>("2025");
  const [verifyingIds, setVerifyingIds] = useState(new Set<string>());
  const [decliningIds, setDecliningIds] = useState(new Set<string>());
  const itemsPerPage = 6;
  const {emitEvent, onEvent, offEvent, connected} = useSocket();
  // Stored user data for headId
  const parsedData = readStoredUserData();
  const headId = parsedData?.headId;
  // FIXED: useGlobalPush at top level for Head (enables push)
  // const {requestPermission} = useGlobalPush(headId,'head')
  // Memoized total unread calculation
const calculatedTotalUnread = useMemo(() => 
  projectDetails.reduce((sum, p) => {
    if (!isQuietProjectStatus(p.status)) {
      return sum + p.unreadFromClient + p.unreadFromTL;
    }
    return sum;
  }, 0),
  [projectDetails]
);
const pendingVerifyCount = useMemo(
  () => employeeRegRequests.filter((r) => r.status === "pending").length,
  [employeeRegRequests]
);
const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

useEffect(() => {
  const storedUserDataB64 = localStorage.getItem("userData");
  const storedRoleB64 = localStorage.getItem("role");

  if (!storedUserDataB64 || !storedRoleB64) {
    console.warn("No user data or role found. Redirecting to login...");
    window.location.href = "/login-reg";
    return;
  }

  try {
    const role = atob(storedRoleB64);
    if (role !== "Head") {
      window.location.href = "/login-reg";
    }
  } catch {
    window.location.href = "/login-reg";
  }
}, []);

  // Update totalUnread when calculatedTotalUnread changes
  useEffect(() => {
    setTotalUnread(calculatedTotalUnread);
  }, [calculatedTotalUnread]);
  // Memoized handlers to prevent re-attachment issues
  const handleNewMessage = useCallback((data: { fromRole: 'client' | 'tl' | 'head'; msg: any; projectId?: string }) => {
    if (!data.projectId || data.fromRole === 'head') return;
    setProjectDetails((prev) => {
      const updatedProjects = prev.map((proj) => {
        if (proj.project_id !== data.projectId) return proj;
        let newUnreadFromClient = proj.unreadFromClient;
        let newUnreadFromTL = proj.unreadFromTL;
        let newHasMentionFromClient = proj.hasMentionFromClient;
        let newHasMentionFromTL = proj.hasMentionFromTL;
        let incremented = false;
        if (data.fromRole === 'client') {
          if (!data.msg.seen_by?.includes('head')) {
            newUnreadFromClient++;
            incremented = true;
            if (data.msg.mention?.type === 'head') {
              newHasMentionFromClient = true;
            }
          }
        } else if (data.fromRole === 'tl') {
          if (!data.msg.seen_by?.includes('head')) {
            newUnreadFromTL++;
            incremented = true;
            if (data.msg.mention?.type === 'head') {
              newHasMentionFromTL = true;
            }
          }
        }
        if (incremented) {
          playNotificationSound(); // Play sound on increment
        }
        return {
          ...proj,
          unreadFromClient: newUnreadFromClient,
          unreadFromTL: newUnreadFromTL,
          hasMentionFromClient: newHasMentionFromClient,
          hasMentionFromTL: newHasMentionFromTL,
        };
      });
      return updatedProjects;
    });
  }, []);
  const handleMessageSeen = useCallback((data: { fromRole: 'client' | 'tl'; index: number; seen_by: string[]; type: 'chat' | 'audio'; projectId?: string }) => {
    if (!data.projectId) return;
    // On seen, refetch to sync accurate counts (lightweight)
    fetchProjects();
  }, []);
  const handleEmployeeRegUpdate = useCallback((data: { id: string; status: 'pending' | 'accepted' | 'rejected' }) => {
    setEmployeeRegRequests((prev) =>
      prev
        .map((item) =>
          item.id === data.id ? { ...item, status: data.status } : item
        )
        .sort(sortByLatestDate)
    );
  }, []);
  // NEW: Ref to track if socket listeners added (prevents duplicates)
  const listenersAddedRef = useRef(false);
  // UPDATED: Socket listeners attachment (only once when connected)
  useEffect(() => {
    if (!connected || listenersAddedRef.current) return;
    // Attach listeners once
    onEvent('newMessage', handleNewMessage);
    onEvent('messageSeen', handleMessageSeen);
    listenersAddedRef.current = true;
    // Cleanup: Remove listeners on unmount/disconnect
    return () => {
      if (typeof offEvent === 'function') {
        offEvent('newMessage', handleNewMessage);
        offEvent('messageSeen', handleMessageSeen);
      }
      listenersAddedRef.current = false;
    };
  }, [connected, onEvent, offEvent, handleNewMessage, handleMessageSeen, handleEmployeeRegUpdate]);

  
  // UPDATED: Separate effect for joining head room (once when connected)
  useEffect(() => {
    if (!connected) return;
    emitEvent('joinHeadRoom', headId);
  }, [connected, emitEvent, headId]);
  // UPDATED: Separate effect for joining project rooms (when projects load/change)
  useEffect(() => {
    if (!connected || projectDetails.length === 0) return;
    projectDetails.forEach((proj) => {
      emitEvent('joinProject', proj.project_id);
    });
  }, [connected, projectDetails, emitEvent]);
  // NEW: Handle postMessage from SW for navigation (e.g., notification click)
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    console.log('🖱️ Head List: Received window message:', event.data, 'from source:', event.source);
    if (event.source !== window && event.data?.type === 'navigateToProject' && event.data.state?.item) {
      const { project_id } = event.data.state.item;
      console.log('🖱️ Head List: Received navigateToProject for', project_id, 'with item:', event.data.state.item);
      navigate(`/headclientprojectinfo?projectId=${project_id}`, {
        state: { item: event.data.state.item } // Match Head's state prop
      });
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [navigate]);
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      const projectId = null;
      console.log('🖱️ Head List: Sending readyForProject for', projectId || 'list');
      registration.active?.postMessage({
        type: 'readyForProject',
        projectId
      });
    }).catch(err => console.error('SW ready error:', err));
  }
}, []);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const playNotificationSound = () => {
    playChatNotificationSound();
  };

  useEffect(() => {
    unlockChatNotificationSound();
  }, []);
  const fetchEmployees = useCallback(async () => {
    try {
      const employeeRegResponse = await getData('employees/fetch_all_registrations');
      if (employeeRegResponse.status) {
        const sortedData = (employeeRegResponse.data as EmployeeRegRequest[]).sort(sortByLatestDate);
        setEmployeeRegRequests(sortedData);
      } else {
        setError(employeeRegResponse.data?.message || "Failed to fetch employee registrations.");
      }
    } catch (err) {
      setError("Failed to fetch employee registrations. Please try again.");
      console.error("Fetch Employees Error:", err);
    }
  }, []);

  const fetchSecurityKeys = useCallback(async () => {
  try {
    const clientResponse = await getData('clients/fetch_all_clients');
    if (clientResponse.status) {
      setClientDetails(clientResponse.data as ClientListProps[]);
    } else {
      setError(clientResponse.data?.message || "Failed to fetch clients.");
    }

    const teamLeaderResponse = await getData('teamleader/fetch_all_teamleaders');
    if (teamLeaderResponse.status) {
      setTeamLeaderDetails(teamLeaderResponse.data as TeamLeaderListProps[]);
    } else {
      setError(teamLeaderResponse.data?.message || "Failed to fetch team leaders.");
    }
  } catch (err) {
    setError("Failed to fetch security keys. Please try again.");
    console.error("Fetch Security Keys Error:", err);
  }
}, []);

useEffect(() => {
  if (activeTab === "Security Keys") {
    fetchSecurityKeys();
  }
}, [activeTab, fetchSecurityKeys]);
useEffect(() => {
  if (activeTab !== "Security Keys") return;

  const interval = setInterval(() => {
    fetchSecurityKeys();
  }, 15000);

  return () => clearInterval(interval);
}, [activeTab, fetchSecurityKeys]);

const fetchProjects = useCallback(async () => { 
  try {
    const response = await getData(`clientproject/show_all_clientsprojects`);
    if (response.status) {
      const projectList = response.data || [];
      const detailedPromises = projectList.map(async (project: any) => {
        try {
          const projResponse = await getData(`clientproject/get_project/${project.project_id}`);
          if (projResponse.status && projResponse.data) {
            const proj = projResponse.data;
            const clientChats = proj.clientchats || [];
            const clientAudios = proj.clientaudios || [];
            const tlChats = proj.tlchats || [];
            const tlAudios = proj.tlaudios || [];
            const clientName = proj.clientName || "Client";
            const teamLeaderName = proj.teamLeaderName || "Team Leader";
            let unreadFromClient = 0;
            let unreadFromTL = 0;
            let hasMentionFromClient = false;
            let hasMentionFromTL = false;
            [...clientChats, ...clientAudios].forEach((chat: string) => {
              try {
                const parsed = JSON.parse(chat);
                if (!parsed.seen_by || !parsed.seen_by.includes("head")) {
                  unreadFromClient++;
                  if (parsed.mention && parsed.mention.type === "head") {
                    hasMentionFromClient = true;
                  }
                }
              } catch (err) {
                console.error(err);
              }
            });
            [...tlChats, ...tlAudios].forEach((chat: string) => {
              try {
                const parsed = JSON.parse(chat);
                if (!parsed.seen_by || !parsed.seen_by.includes("head")) {
                  unreadFromTL++;
                  if (parsed.mention && parsed.mention.type === "head") {
                    hasMentionFromTL = true;
                  }
                }
              } catch (err) {
                console.error(err);
              }
            });
            const progressResponse = await getData(`clientproject/get_progress/${project.project_id}`);
            let progressPercentage = 0;
            if (progressResponse.status && progressResponse.progress) {
              const { payment = '0%', work = '0%' } = progressResponse.progress;
              const paymentNum = parseInt(payment.replace('%', '')) || 0;
              const workNum = parseInt(work.replace('%', '')) || 0;
              progressPercentage = (paymentNum + workNum) / 2;
            }
            return {
              title: proj.title || "",
              workstream: proj.workstream || "",
              clientName,
              project_id: project.project_id,
              deadline: proj.deadline || "",
              budget: proj.budget || 0,
              description: Array.isArray(proj.description) ? proj.description.join('<br/><br/>') : proj.description || '',
              unreadFromClient,
              unreadFromTL,
              hasMentionFromClient,
              hasMentionFromTL,
              teamLeaderName,
              status: project.status,
              progress: progressPercentage,
              active_date: proj.active_date || null,
            };
          }
          return null;
        } catch (err) {
          console.error(`Error fetching project ${project.project_id}:`, err);
          return null;
        }
      });
      const detailedProjects = (await Promise.all(detailedPromises)).filter(Boolean) as Project[];
      const newTotalUnread = detailedProjects.reduce((sum: number, p: Project) => {
  if (!isQuietProjectStatus(p.status)) {
    return sum + p.unreadFromClient + p.unreadFromTL;
  }
  return sum;
}, 0);
      setTotalUnread(newTotalUnread);
      setProjectDetails(detailedProjects);
      // Calculate start and end years dynamically
      if (detailedProjects.length > 0) {
        let minYear = Infinity;
        let maxYear = -Infinity;
        detailedProjects.forEach((p: Project) => {
          const year = new Date(p.deadline).getFullYear();
          if (year < minYear) minYear = year;
          if (year > maxYear) maxYear = year;
        });
        setProjectStartDate(minYear.toString());
        setProjectEndDate(maxYear.toString());
        console.log(projectEndDate, projectStartDate)
      }
    }
  } catch (err) {
    setError("Failed to fetch projects. Please try again.");
    console.error("Fetch Projects Error:", err);
  }
}, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      await fetchProjects();
      const clientResponse = await getData('clients/fetch_all_clients');
      if (clientResponse.status) {
        setLoading(false);
        setClientDetails(clientResponse.data as ClientListProps[]);
      } else {
        setError(clientResponse.data?.message || "Failed to fetch clients.");
      }
      const teamLeaderResponse = await getData('teamleader/fetch_all_teamleaders');
      if (teamLeaderResponse.status) {
        setTeamLeaderDetails(teamLeaderResponse.data as TeamLeaderListProps[]);
      } else {
        setError(teamLeaderResponse.data?.message || "Failed to fetch team leaders.");
      }
      await fetchEmployees();
    };
    fetchData();
  }, [fetchEmployees]);
  // Listen for new project creation (Client uploads → notify Head live)
useEffect(() => {
  if (!connected) return;

  const handleNewProject = () => {
    fetchProjects();
  };

  onEvent('newProjectCreated', handleNewProject);

  return () => {
    if (typeof offEvent === 'function') {
      offEvent('newProjectCreated', handleNewProject);
    }
  };
}, [connected, onEvent, offEvent, fetchProjects]);

// Listen for project status changes (Sales TL activates → Head sees it live)
useEffect(() => {
  if (!connected) return;

  const handleProjectStatusUpdate = () => {
    // Refetch so the project appears/disappears correctly based on status
    fetchProjects();
  };

  const offA = onEvent("projectStatusUpdate", handleProjectStatusUpdate);
  const offB = onEvent("projectStatusUpdated", handleProjectStatusUpdate);

  return () => {
    offA?.();
    offB?.();
    if (typeof offEvent === "function") {
      offEvent("projectStatusUpdate", handleProjectStatusUpdate);
      offEvent("projectStatusUpdated", handleProjectStatusUpdate);
    }
  };
}, [connected, onEvent, offEvent, fetchProjects]);

// ✅ CONSOLIDATED + RELIABLE EMPLOYEE REGISTRATION SOCKET LISTENERS
// Replace the existing consolidated employee registration useEffect with:
useEffect(() => {
  if (!connected) return;

  const handleNewEmployeeRegistration = (data: EmployeeRegRequest) => {
    console.log('🟢 New employee registration received via socket:', data);
    setEmployeeRegRequests((prev) => {
      if (prev.some(item => item.id === data.id)) return prev;
      return [data, ...prev].sort(sortByLatestDate);
    });
    // Also refetch to ensure consistency
    fetchEmployees();
  };

  const handleEmployeeRegUpdate = (data: { id: string; status: 'pending' | 'accepted' | 'rejected' }) => {
    console.log('🔄 Employee status update received via socket:', data);
    setEmployeeRegRequests((prev) =>
      prev
        .map((item) =>
          item.id === data.id ? { ...item, status: data.status } : item
        )
        .sort(sortByLatestDate)
    );
  };

  onEvent('newEmployeeRegistration', handleNewEmployeeRegistration);
  onEvent('employeeRegUpdate', handleEmployeeRegUpdate);

  return () => {
    offEvent('newEmployeeRegistration', handleNewEmployeeRegistration);
    offEvent('employeeRegUpdate', handleEmployeeRegUpdate);
  };
}, [connected, onEvent, offEvent, fetchEmployees]);

useEffect(() => {
  if (activeTab !== "Verify Employee") return;

  // Poll every 15 seconds while on this tab
  const interval = setInterval(() => {
    fetchEmployees();
  }, 15000);

  return () => clearInterval(interval);
}, [activeTab, fetchEmployees]);

useEffect(() => {
  if (activeTab === "Verify Employee") {
    fetchEmployees();
  }
}, [activeTab, fetchEmployees]);

  const handleDeleteItem = async (key_id: string, isTeamLeader: boolean) => {
    const endpoint = isTeamLeader ? 'teamleader/delete_teamleader' : 'clients/delete_client';
    const body = { key_id };
    try {
      const response = await postData(endpoint, body);
      if (response.status) {
        if (isTeamLeader) {
          setTeamLeaderDetails((prev) => prev.filter((item) => item.key_id !== key_id));
        } else {
          setClientDetails((prev) => prev.filter((item) => item.key_id !== key_id));
        }
      } else {
        setError(response.message || `Failed to delete ${isTeamLeader ? 'team leader' : 'client'}.`);
      }
    } catch (err) {
      setError(`Failed to delete ${isTeamLeader ? 'team leader' : 'client'}. Please try again.`);
      console.error("Delete Error:", err);
    }
  };
  const handleEditItem = async (key_id: string, updatedData: { name: string; email: string; mobile: string }, isTeamLeader: boolean) => {
    const endpoint = isTeamLeader ? 'teamleader/edit_teamleader' : 'clients/edit_client';
    const body = { key_id, ...updatedData };
    try {
      const response = await postData(endpoint, body);
      if (response.status && response.data) {
        if (isTeamLeader) {
          setTeamLeaderDetails((prev) =>
            prev.map((item) =>
              item.key_id === key_id
                ? { key_id, name: response.data.name, email: response.data.email, mobile: response.data.mobile }
                : item
            )
          );
        } else {
          setClientDetails((prev) =>
            prev.map((item) =>
              item.key_id === key_id
                ? { key_id, name: response.data.name, email: response.data.email, mobile: response.data.mobile }
                : item
            )
          );
        }
        setEditItem(null);
        setConfirmEdit(false);
      } else {
        setError(response.message || `Failed to edit ${isTeamLeader ? 'team leader' : 'client'}.`);
      }
    } catch (err) {
      setError(`Failed to edit ${isTeamLeader ? 'team leader' : 'client'}. Please try again.`);
      console.error("Edit Error:", err);
    }
  };
const handleVerifyEmployee = async (requestId: string) => {
  if (verifyingIds.has(requestId)) return;

  const prevRequests = [...employeeRegRequests]; // for rollback

  // 1. OPTIMISTIC UPDATE – immediate UI change
  setEmployeeRegRequests((prev) =>
    prev
      .map((item) =>
        item.id === requestId ? { ...item, status: 'accepted' as const } : item
      )
      .sort(sortByLatestDate)
  );

  setVerifyingIds((prev) => new Set([...prev, requestId]));

  try {
    const response = await postData(`employees/admin/accept_employee_request/${requestId}`, {});
    if (!response.status) throw new Error(response.message || "Failed to verify");
    // Success → optimistic update already applied
  } catch (err) {
    console.error("Verify failed:", err);
    setEmployeeRegRequests(prevRequests); // rollback
    setError("Failed to verify employee. Please try again.");
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

  const prevRequests = [...employeeRegRequests]; // for rollback

  // 1. OPTIMISTIC UPDATE – immediate UI change
  setEmployeeRegRequests((prev) =>
    prev
      .map((item) =>
        item.id === requestId ? { ...item, status: 'rejected' as const } : item
      )
      .sort(sortByLatestDate)
  );

  setDecliningIds((prev) => new Set([...prev, requestId]));

  try {
    const response = await postData(`employees/admin/reject_employee_request/${requestId}`, {});
    if (!response.status) throw new Error(response.message || "Failed to decline");
  } catch (err) {
    console.error("Decline failed:", err);
    setEmployeeRegRequests(prevRequests); // rollback
    setError("Failed to decline employee. Please try again.");
  } finally {
    setDecliningIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(requestId);
      return newSet;
    });
  }
};
  const handleKeyFilterChange = useCallback((filters: string[]) => {
    setKeyFilter(filters[0] || "All");
  }, []);
  // Sort projects: first by total unread (descending), then by status (On-Going first), then by deadline (descending)
  const sortedProjectDetails = [...projectDetails].sort((a, b) => {
    const aTotalUnread = a.unreadFromClient + a.unreadFromTL;
    const bTotalUnread = b.unreadFromClient + b.unreadFromTL;
    if (aTotalUnread !== bTotalUnread) {
      return bTotalUnread - aTotalUnread;
    }
    const aStatus = new Date(a.deadline) > new Date() ? "On-Going" : "Submitted";
    const bStatus = new Date(b.deadline) > new Date() ? "On-Going" : "Submitted";
    if (aStatus === "On-Going" && bStatus === "Submitted") return -1;
    if (aStatus === "Submitted" && bStatus === "On-Going") return 1;
    return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
  });
 const filteredProjects = sortedProjectDetails.filter(
  (item) => {
    // Existing search logic
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.project_id.toString().includes(searchQuery) ||
      item.deadline.toString().includes(searchQuery.toLowerCase()) ||
      item.budget.toString().includes(searchQuery.toLowerCase());

    // Enhanced filter logic
    if (selectedFilters.length === 0) return matchesSearch;

    // Check for workstream matches (existing)
    const workstreamMatch = selectedFilters.some(filter => filter.toLowerCase() === item.workstream.toLowerCase());

    // Handle "Deadline" filter specially
    const deadlineMatch = selectedFilters.some(filter => filter === "Deadline");
    if (deadlineMatch) {
      const projectYear = new Date(item.deadline).getFullYear().toString();
      const status = new Date(item.deadline) > new Date() ? "On-Going" : "Submitted";
      // Example: Show all "On-Going" or within year range; customize as needed
      return matchesSearch && (status === "On-Going" || (projectYear >= projectStartDate && projectYear <= projectEndDate));
    }

    return matchesSearch && workstreamMatch;
  }
);
  const combinedKeys: SecurityKey[] = useMemo(() => [
    ...clientDetails.map(c => ({ ...c, type: "client" as const })),
    ...teamLeaderDetails.map(t => ({ ...t, type: "teamLeader" as const }))
  ].sort(sortByLatestDate), [clientDetails, teamLeaderDetails]);
  const filteredSecurityKeys = useMemo(() => {
    return combinedKeys.filter((item) =>
      item.key_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.mobile.toString().includes(searchQuery.toLowerCase())
    ).filter((item) => {
      if (keyFilter === "All") return true;
      const targetType = keyFilter === "Client" ? "client" : "teamLeader";
      return item.type === targetType;
    });
  }, [combinedKeys, searchQuery, keyFilter]);
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
  const totalPages = Math.max(
  1,
  Math.ceil(
    activeTab === "All Projects"
      ? filteredProjects.length / itemsPerPage
      : activeTab === "Security Keys"
      ? filteredSecurityKeys.length / itemsPerPage
      : activeTab === "Employees"
      ? filteredEmployeeRequests.length / itemsPerPage
      : activeTab === "Verify Employee"
      ? filteredEmployeeRequests.length / itemsPerPage
      : filteredEmployeeRequests.length / itemsPerPage
  )
);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);
  const currentSecurityKeys = filteredSecurityKeys.slice(startIndex, endIndex);
  const currentEmployeeRequests = filteredEmployeeRequests.slice(startIndex, endIndex);
  const projectFilters = ["Data Science", "AI", "Plagarism removal", "Thesis", "Software Development", "Deadline"];
  const departmentFilters = ["Technical", "Sales"];
  const statusFilterOptions = ["Pending", "Verified", "Rejected"];
  const keyFilters = ["Client", "Team Leader"];
  const maxProjectTextLength = Math.max(
    ...projectDetails.map((item) => (item.clientName + item.project_id).length),
    10
  );
  const maxSecurityKeyTextLength = Math.max(
    ...clientDetails.map((item) => (item.name + item.key_id).length),
    ...teamLeaderDetails.map((item) => (item.name + item.key_id).length),
    10
  );
  const maxEmployeeRequestTextLength = Math.max(
    ...employeeRegRequests.map((item) => (item.employeeName + item.employmentID).length),
    10
  );
  const getWidthClass = (maxLength: number) =>
    maxLength > 30 ? "w-[300px]" : maxLength > 20 ? "w-[250px]" : "w-[200px]";
  useEffect(() => {
    setCurrentPage(1);
    if (activeTab === "Employees") {
      setSelectedFilters(["Technical"]);
      setStatusFilters([]);
    } else if (activeTab === "Security Keys") {
      setKeyFilter("All");
      setSelectedFilters([]);
      setStatusFilters([]);
    } else if (activeTab !== "Verify Employee") {
      setSelectedFilters([]);
      setStatusFilters([]);
    }
  }, [activeTab]);
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
  const handleFilterChange = (filters: string[]) => {
    setSelectedFilters(filters);
  };
  const handleClearFilters = useCallback(() => {
  setSelectedFilters([]); // Resets to show all projects
  setStatusFilters([]); // If needed for other tabs
}, []);
  const alignContainerRef = useRef<HTMLDivElement>(null);
  const navStartRef = useRef<HTMLDivElement>(null);
  const [tableStart, setTableStart] = useState(0);

  const updateTableStart = useCallback(() => {
    const container = alignContainerRef.current;
    const nav = navStartRef.current;
    if (!container || !nav) return;
    const firstTab = nav.querySelector<HTMLElement>("[data-nav-start]");
    const startEl = firstTab ?? nav;
    const offset =
      startEl.getBoundingClientRect().left - container.getBoundingClientRect().left;
    setTableStart(Math.max(0, Math.round(offset)));
  }, []);

  useEffect(() => {
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
  }, [updateTableStart, loading, activeTab, width]);

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;
  const tabs = ["All Projects", "Employees", "Verify Employee", "Security Keys"];
  const textSize = is2XL ? "text-[15px]" : "text-[12px]";
 
//   const IconAt = () => (
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
  if (loading) {
    return <PageLoadingComponent />;
  }
  if (error) {
    return (
      <div className="text-red-500 text-[14px] font-normal mt-7">
        Error: {error}
      </div>
    );
  }
  return (
    <div
      className={`flex w-full ${
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
        
        <div className={`${isXXS || isXS || isSM || isMD ? "w-fit overflow-x-auto" : "w-full overflow-visible"} flex items-center flex-col space-y-4`}>
          <div className="w-full flex justify-center items-center">
            <div className="w-fit flex items-center space-x-10">
            {(isXXS || isXS || isSM || isMD) && (
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
              isXXS || isXS || isSM || isMD
                ? "flex w-full flex-col items-center"
                : "w-full flex flex-col overflow-visible"
            }
          >
          <div
            ref={navStartRef}
            className="w-full flex justify-center overflow-visible relative z-10"
          >
          <Navigation1 
  tabs={tabs} 
  activeTab={activeTab} 
  setActiveTab={(tab) => {
    setActiveTab(tab);
    localStorage.setItem("headProjectListActiveTab", tab);
  }} 
  totalUnreadAll={totalUnread} 
  totalPendingVerify={pendingVerifyCount}
  centered
/>
          </div>
          <div className={`relative flex w-full items-start mt-7`}>
          {(activeTab === "All Projects" || activeTab === "Verify Employee" || activeTab === "Employees" || activeTab === "Security Keys") && (
            (isXXS || isXS || isSM || isMD)
              ? renderDrawer && (
                <div
                  className={`
                    fixed top-9 left-0 w-[280px] z-50 bg-blue-50 p-4 rounded-br-[10px]
                    transform transition-transform duration-300 ease-in-out
                    ${drawerVisible ? "translate-x-0" : "-translate-x-full"}
                  `}
                >
                  <Filter
                    filters={activeTab === "All Projects" ? projectFilters : activeTab === "Employees" ? departmentFilters : activeTab === "Verify Employee" ? statusFilterOptions : keyFilters}
                    setClose={() => setShowFilter(false)}
                    setSelectedFilters={activeTab === "Security Keys" ? handleKeyFilterChange : activeTab === "Verify Employee" ? setStatusFilters : handleFilterChange}
                    singleSelect={activeTab === "Employees" || activeTab === "Security Keys"}
                  onClear={handleClearFilters}
                  />
                </div>
              )
              : (
              <div className="absolute left-0 top-4 [&>div]:mx-0">
                <Filter
                  filters={activeTab === "All Projects" ? projectFilters : activeTab === "Employees" ? departmentFilters : activeTab === "Verify Employee" ? statusFilterOptions : keyFilters}
                  setClose={setShowFilter}
                  setSelectedFilters={activeTab === "Security Keys" ? handleKeyFilterChange : activeTab === "Verify Employee" ? setStatusFilters : handleFilterChange}
                  singleSelect={activeTab === "Employees" || activeTab === "Security Keys"}
                onClear={handleClearFilters}
                />
              </div>
              )
          )}
          <div
            className={
              isXXS || isXS || isSM || isMD
                ? "flex w-full flex-col"
                : "w-full min-w-0"
            }
            style={
              isXXS || isXS || isSM || isMD
                ? undefined
                : { paddingLeft: tableStart }
            }
          >
          <div className={`flex  w-full gap-x-5 items-start shrink-0 flex-row`}>
        <div
          className={`flex flex-col ${
            isXXS || isXS || isSM || isMD
              ? "w-full flex"
              : "w-full"
          }`}
        >
          <div className="overflow-x-auto">
            {
  activeTab === "All Projects" ? (
    currentProjects.length > 0 ? (
      currentProjects.map((item, index) => {
        // const totalUnreadForProject = item.unreadFromClient + item.unreadFromTL;
        const status = item.status; // Use fetched status
        const textColor = status === "Completed" ? "text-gray-600" : "text-[#000000]";
        return (
          <div
            onClick={() => navigate(`/headclientprojectinfo`, { state: { item } })}
            key={index}
            className={`flex cursor-pointer justify-start items-start ${
              index === currentProjects.length - 1 ? "mt-5" : "my-0 "
            } w-full min-w-[700px] flex-col`}
          >
            <div className="flex flex-col-reverse items-start justify-start w-full">
              <div className="flex items-start justify-between w-full">
                <div className={`flex font-semibold ${textColor} ${textSize} space-x-2 -tracking-[0.02rem]`}>
                <Button1
                  width={getWidthClass(maxProjectTextLength)}
                  gradientType={status === "Completed" ? "" : "gradient1"}
                  text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                  value={item.workstream}
                />
                <div className="flex items-center gap-2 pl-2.5 py-0.5">
  <span className="font-mono text-[14px] font-bold text-slate-900 tracking-tight">
    ID:{item.project_id}
  </span>
</div>
              
                
{(item.unreadFromClient + item.unreadFromTL > 0) &&
  !isQuietProjectStatus(item.status) &&
  !dismissedNotifications.has(item.project_id) && (
    <div className="flex items-center justify-center gap-2 ml-3">
      {/* Green = normal unread message */}
      <span
        className="relative flex h-3 w-3 cursor-pointer"
        title="New message"
        onClick={(e) => {
          e.stopPropagation();
          setDismissedNotifications((prev) => new Set([...prev, item.project_id]));
        }}
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
      </span>

      {/* Blue = tagged / mentioned */}
      {(item.hasMentionFromClient || item.hasMentionFromTL) && (
        <span
          className="relative flex h-3 w-3 cursor-pointer"
          title="You were tagged"
          onClick={(e) => {
            e.stopPropagation();
            setDismissedNotifications((prev) => new Set([...prev, item.project_id]));
          }}
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
      )}
    </div>
  )}
    </div>
              </div>
              <div className="border-t-2 border-[#000000] w-full"></div>
            </div>
            <div
              className={`flex mt-3 w-full pl-[2vw] justify-between items-center`}
            >
              <div
                className={`${textColor} w-[30%] text-start flex font-normal ${textSize} -tracking-[0.02rem]`}
              >
                {item.title}
              </div>
<div className="flex flex-col w-full sm:w-[30%] gap-1.5">
  
  {/* Submission Date */}
  <div className={`flex items-center gap-2 ${textColor} ${textSize}`}>
    {/* Minimalist Calendar Icon */}
    <svg 
      className="w-3.5 h-3.5 text-gray-400" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    <span className="text-gray-500">Submission Date:</span>
    <span className="font-semibold text-gray-800 tracking-tight">
      {new Date(item.deadline).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })}
    </span>
  </div>
 

  {/* Active Status */}
  {item.active_date && item.status === "Active" && (
    <div className="flex items-center gap-2 text-[12px]">
      {/* Refined Status Dot */}
      <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-100">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
      </div>
      <span className="text-emerald-700 font-medium tracking-tight">
        Active since {new Date(item.active_date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        })}
      </span>
    </div>
  )}
  
</div>
              <div
  className={`${textColor} w-[20%] ${textSize} flex flex-col items-center justify-center`}
>
  <CircularProgress progress={item.progress} />
  {/* <div>{item.progress}% Completed</div> */}
</div>
              <div
                className={`${textColor} w-[20%] space-y-1 font-normal text-[12px] -tracking-[0.02rem]`}
              >
                <div>₹ {item.budget}/-</div>
                <div>Amount Left</div>
              </div>
            </div>
          </div>
        );
      })
    ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
  {/* Modern, subtle icon */}
<FaRegFolder size={40} color="gray" />
  
  <h3 className="text-gray-900 font-medium text-[15px]">No projects yet</h3>
  <p className="text-gray-500 text-[13px] max-w-[80%] mt-1 mb-5">
    When Team Leader Active project, then it will be showing here, although you can refresh to check again!
  </p>

</div>
              )
            ) : activeTab === "Security Keys" ? (
              currentSecurityKeys.length > 0 ? (
                currentSecurityKeys.map((item, index) => (
                  <div
                    key={index}
                    className={`flex justify-start items-start ${
                      index === currentSecurityKeys.length - 1 ? "mt-0" : "my-5 mt-0"
                    } w-full min-w-[800px] flex-col`}
                  >
                    <div className="flex flex-col-reverse items-start justify-start w-full">
                      <div>
                        <Button1
                          width={getWidthClass(maxSecurityKeyTextLength)}
                          gradientType="gradient1"
                          text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                          value={item.name}
                        />
                      </div>
                      <div className="border-t-2 border-[#000000] w-full"></div>
                    </div>
                    <div className="flex mt-2 w-full pl-[2vw] justify-between items-center">
                      <div
                        className={`text-[#000000] w-[15%] text-start flex font-normal ${textSize} -tracking-[0.02rem]`}
                      >
                        Type: {item.type === "client" ? "Client" : "Team Leader"}
                      </div>
                      <div
                        className={`text-[#000000] w-[25%] text-start flex font-normal ${textSize} -tracking-[0.02rem]`}
                      >
                        Security Key: {item.key_id}
                      </div>
                      <div
                        className={`text-[#000000] font-normal flex justify-center w-[30%] ${textSize} -tracking-[0.02rem]`}
                      >
                        {item.email}
                      </div>
                      <div
                        className={`text-[#000000] w-[15%] font-normal text-[12px] -tracking-[0.02rem]`}
                      >
                        Mobile: {item.mobile}
                      </div>
                      <div className="flex space-x-2 ml-auto">
                        <div
                          onClick={() => {
                            setSelectedId(item.key_id);
                            setSelectedMail(item.email);
                            setSelectedType(item.type);
                            setConfirmDelete(true);
                          }}
                          className={`w-fit bg-red-100 hover:bg-red-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center`}
                        >
                          <FaTrash
                            size={16}
                            className="text-red-500 cursor-pointer"
                            title="Delete Key"
                          />
                        </div>
                        <div
                          onClick={() => {
                            setEditItem(item);
                            setConfirmEdit(true);
                          }}
                          className={`w-fit bg-green-100 hover:bg-green-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center`}
                        >
                          <MdEdit
                            size={16}
                            className="text-green-500 cursor-pointer"
                            title="Edit Key"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="mt-7 flex flex-col items-center justify-center">
  <div className="bg-white p-3 rounded-full shadow-sm mb-4">
    <IoKeyOutline color="gray" size={40} />
  </div>
  <p className="text-gray-900 font-medium text-[15px]">No security keys found</p>
  <p className="text-gray-500 text-[13px] mt-1 mb-5 max-w-[80%]">Add a physical hardware key to provide the strongest protection for your account.</p>

</div>
              )
            ) : activeTab === "Employees" ? (
              <div>
                <AllEmployeeList selectedDepartment={selectedFilters[0] || "Technical"} />
              </div>
            ) : activeTab === "Verify Employee" ? (
              currentEmployeeRequests.length > 0 ? (
                currentEmployeeRequests.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex justify-start items-start ${
                      index === currentEmployeeRequests.length - 1 ? "mt-0" : "my-5 mt-0"
                    } w-full min-w-[850px] flex-col`}
                  >
                    <div className="flex flex-col-reverse items-start justify-start w-full">
                      <div>
                        <Button1
                          width={getWidthClass(maxEmployeeRequestTextLength)}
                          gradientType="gradient1"
                          text={`${is2XL ? "text-[15px]" : "text-[12px]"}`}
                          value={item.employeeName}
                        />
                      </div>
                      <div className="border-t-2 border-[#000000] w-full"></div>
                    </div>
                    <div className="flex mt-2 w-full pl-[2vw] justify-between items-center">
                      <div
                        className={`text-[#000000] w-[33.33%] text-start flex font-normal ${textSize} -tracking-[0.02rem]`}
                      >
                        Employee ID: {item.employmentID}
                      </div>
                      <div
                        className={`text-[#000000] font-normal flex justify-start w-[33.33%] ${textSize} -tracking-[0.02rem]`}
                      >
                        Email: {item.employeeMail}
                      </div>
                      <div className={`w-[33.33%] flex justify-center items-center`}>
                        {item.status === "pending" ? (
                          <div className="flex space-x-2">
                            <div
                              onClick={() => handleVerifyEmployee(item.id)}
                              className={`bg-green-100 hover:bg-green-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center ${verifyingIds.has(item.id) ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <span className={`font-semibold text-[12px] ${verifyingIds.has(item.id) ? 'text-gray-500' : 'text-green-500'}`}>
                                {verifyingIds.has(item.id) ? "Verifying..." : "Verify"}
                              </span>
                            </div>
                            <div
                              onClick ={() => handleDeclineEmployee(item.id)}
                              className={`bg-red-100 hover:bg-red-200 hover:scale-95 transition-transform duration-200 cursor-pointer p-2 rounded-full flex justify-center items-center ${decliningIds.has(item.id) ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <span className={`font-semibold text-[12px] ${decliningIds.has(item.id) ? 'text-gray-500' : 'text-red-500'}`}>
                                {decliningIds.has(item.id) ? "Declining..." : "Decline"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`text-[#000000] ${
                              item.status === "accepted"
                                ? "rounded-full bg-[#A3FFA1] p-2"
                                : "bg-[#FFB2A3] rounded-full p-2"
                            } font-normal text-[12px] -tracking-[0.02rem]`}
                          >
                            {item.status === "accepted" ? (
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
                ))
              ) : (
                <div className="mt-7 flex flex-col items-center justify-center">
  <div className="bg-white p-3 rounded-full shadow-sm mb-4">
    <FaUsers color="gray" size={40} />
  </div>
  <p className="text-gray-900 font-medium text-[15px]">No employee registrations found</p>
  <p className="text-gray-500 text-[13px] mt-1 mb-5">Try adjusting your filters or add a new staff member.</p>

</div>
              )
            ) : (
              <div className="text-[#000000] text-[14px] font-normal mt-7">
                Invalid tab selected
              </div>
            )}
          </div>
          {confirmDelete && selectedId && (
    <DeleteConfirm
      mail={selectedMail ?? ""}
      isOpen={confirmDelete}
      onClose={() => {
        setConfirmDelete(false);
        setSelectedId(null);
        setSelectedMail(null);
        setSelectedType(null); // NEW: Reset type
      }}
      onConfirm={() => {
        const isTeamLeader = selectedType === "teamLeader"; // UPDATED: Use selectedType
        handleDeleteItem(selectedId, isTeamLeader);
        setConfirmDelete(false);
        setSelectedId(null);
        setSelectedMail(null);
        setSelectedType(null); // NEW: Reset type
      }}
    />
  )}
          {confirmEdit && editItem && (
    <EditConfirm
      initialClient={editItem} // Assuming this prop accepts SecurityKey; adjust typing if needed
      isOpen={confirmEdit}
      onClose={() => {
        setConfirmEdit(false);
        setEditItem(null);
      }}
      onConfirm={async (updated) => {
        const isTeamLeader = editItem.type === "teamLeader"; // UPDATED: Use editItem.type
        await handleEditItem(editItem.key_id, updated, isTeamLeader);
      }}
    />
  )}
        </div>
          </div>
          </div>
          </div>
          </div>
        </div>
      </div>
      

      
      {activeTab !== "Employees" && (
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
export default HeadProjectList;
