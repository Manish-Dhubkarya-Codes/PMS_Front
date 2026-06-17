import { useEffect, useState, useContext, useRef, useCallback } from "react";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import Button4 from "../../UI_Components/Buttons/Button4";
import Button1 from "../../UI_Components/Buttons/Button1";
import PaginationNav from "../../UI_Components/Navigations/PaginationNav";
import { AuthContext } from "../Authentication/AuthContext";
import { postData, serverURL } from "../../BackendConnections/FetchBackendServices";
import { getData } from "../../BackendConnections/FetchBackendServices";
import { useNavigate } from "react-router-dom";
import { IoAdd } from "react-icons/io5";
import { BsArchive } from "react-icons/bs";
import { FaUser } from "react-icons/fa";
import PageLoadingComponent from "../../UI_Components/Pop_Ups/PageLoadingComponent";
import { useSocket } from "../../BackendConnections/useSocket";
import { MdCancel } from "react-icons/md";

interface Project {
  Title: string;
  Workstream: string;
  Description: string;
  SubmissionDate: string;
  status: string;
  ProjectId: string;
  unreadFromHead: number;
  unreadFromTL: number;
  hasMentionFromHead: boolean;
  hasMentionFromTL: boolean;
  hasSOWFromHead: boolean;
  headName: string;
  teamLeaderName: string;
}

const ClientProfile: React.FC = () => {
  const [width, setWidth] = useState(window.innerWidth);
  const [currentPage, setCurrentPage] = useState(1);
  const [projectDetails, setProjectDetails] = useState<Project[]>([]);
  const [projectStartDate, setProjectStartDate] = useState<string>("2024");
  const [projectEndDate, setProjectEndDate] = useState<string>("2025");
  const [projectOnGoing, setProjectOnGoing] = useState<number>(0);
  const [projectCompleted, setProjectCompleted] = useState<number>(0);
  const [totalUnread, setTotalUnread] = useState<number>(0);
  const [loading, setLoading]=useState(true)
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [clientData, setClientData] = useState<{
    ClientName: string;
    Profile: string;
    Designation: string;
    Degree: string;
    ClientId: number;
  } | null>(null);
  const itemsPerPage = 6;

  // Socket integration
  const { emitEvent, onEvent, offEvent, connected } = useSocket();

  // Access AuthContext
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error("ClientProfile must be used within an AuthProvider");
  }
  const { logout: contextLogout } = authContext;
  // Play notification sound
  const playNotificationSound = () => {
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/01/18/audio_d3fd80e4d7.mp3');
    audio.play().catch(err => console.error("Error playing notification sound:", err));
  };

  // Helper function to compute unread counts
const computeUnread = (projectData: any) => {
  // Helper to ensure chats are an array (handles stringified JSON array or direct array)
  const getChatArray = (chatsProp: any) => {
    let chats = chatsProp || [];
    if (typeof chats === 'string') {
      try {
        chats = JSON.parse(chats);
      } catch {
        chats = [];
      }
    }
    return Array.isArray(chats) ? chats : [];
  };

const headChats = getChatArray(projectData.headchats);
  const headAudios = getChatArray(projectData.headaudios);
  const tlChats = getChatArray(projectData.tlchats);
  const tlAudios = getChatArray(projectData.tlaudios);
  const headName = projectData.headname || "Head";
  const teamLeaderName = projectData.teamleadername || "Team Leader";

  let unreadFromHead = 0;
  let unreadFromTL = 0;
  let hasMentionFromHead = false;
  let hasMentionFromTL = false;
  let hasSOWFromHead = false;

  const processMessage = (msg: any, isFromHead: boolean) => {
    let parsed;
    if (typeof msg === 'string') {
      try {
        parsed = JSON.parse(msg);
      } catch {
        return; // Ignore invalid JSON strings
      }
    } else {
      parsed = msg; // Assume it's already an object
    }

    if (!parsed || typeof parsed !== 'object') return;

    let seenBy = parsed.seen_by || [];
    if (typeof seenBy === 'string') {
      seenBy = seenBy.split(',').map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(seenBy)) {
      seenBy = [seenBy];
    }

    if (!seenBy.includes("client")) {
      if (isFromHead) {
        unreadFromHead++;
        if (parsed.mention && parsed.mention.type === "client") {
          hasMentionFromHead = true;
        }
        if (parsed.type === "file" && parsed.data?.name?.toUpperCase().includes("SOW")) {
          hasSOWFromHead = true;
        }
      } else {
        unreadFromTL++;
        if (parsed.mention && parsed.mention.type === "client") {
          hasMentionFromTL = true;
        }
      }
    }
  };

  [...headChats, ...headAudios].forEach((chat) => processMessage(chat, true));

  [...tlChats, ...tlAudios].forEach((chat) => processMessage(chat, false));

  return {
    unreadFromHead,
    unreadFromTL,
    hasMentionFromHead,
    hasMentionFromTL,
    hasSOWFromHead,
    headName,
    teamLeaderName,
  };
};

  const fetchProjects = async (clientId: number) => {
    try {
      // Add cache-busting timestamp to ensure fresh data on every fetch
      const timestamp = Date.now();
      const response = await getData(`clientproject/get_client_projects/${clientId}?_t=${timestamp}`);
      if (response.status) {
        const projectList = response.data || [];

        // Process projects directly from the list (no secondary fetches needed)
        const detailedProjects: Project[] = projectList.map((project: any) => {
  const { unreadFromHead, unreadFromTL, hasMentionFromHead, hasMentionFromTL, hasSOWFromHead, headName, teamLeaderName } = computeUnread(project);

  return {
    Title: project.title || "",
    Workstream: project.workstream || "",
    Description: Array.isArray(project.description) ? project.description.join('<br/><br/>') : project.description || '',
    SubmissionDate: project.deadline || "",
    // NEW: Respect backend "status" (e.g., "Completed" from Team Leader updates) — fallback to deadline logic
    status: project.status === "Completed" ? "Completed" : "On-Going",
    ProjectId: project.project_id,
    unreadFromHead,
    unreadFromTL,
    hasMentionFromHead,
    hasMentionFromTL,
    hasSOWFromHead,
    headName,
    teamLeaderName,
  };
});

        setProjectDetails(detailedProjects);
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
    }
  };

useEffect(() => {
  const newTotalUnread = projectDetails.reduce((sum: number, p: Project) => sum + p.unreadFromHead + p.unreadFromTL, 0);
  setTotalUnread(newTotalUnread);

  // NEW: On-Going = total projects MINUS Completed (as requested)
  const completed = projectDetails.filter((p: Project) => p.status === "Completed").length;
  const onGoing = projectDetails.length - completed;  // Or: projectDetails.filter((p: Project) => p.status !== "Completed").length
  setProjectOnGoing(onGoing);
  setProjectCompleted(completed);

  if (projectDetails.length > 0) {
    let minYear = Infinity;
    let maxYear = -Infinity;
    projectDetails.forEach((p: Project) => {
      const year = new Date(p.SubmissionDate).getFullYear();
      if (year < minYear) minYear = year;
      if (year > maxYear) maxYear = year;
    });
    setProjectStartDate(minYear.toString());
    setProjectEndDate(maxYear.toString());
  }
}, [projectDetails]);

  useEffect(() => {
  const checkClient = async () => {
    const storedUserDataB64 = localStorage.getItem("userData");
    const storedRoleB64 = localStorage.getItem("role");

    if (!storedUserDataB64 || !storedRoleB64) {
      if (contextLogout) {
        contextLogout();
      }
      navigate("/login-reg");
      return;
    }

    try {
      const storedUserData = JSON.parse(atob(storedUserDataB64));
      const role = atob(storedRoleB64);

      if (role !== "Client") {
        if (contextLogout) {
          contextLogout();
        }
        navigate("/login-reg");
        return;
      }

      const { clientId } = storedUserData;
      if (!clientId) {
        if (contextLogout) {
          contextLogout();
        }
        navigate("/login-reg");
        return;
      }

      // Call backend API to verify client existence
      const response = await postData("clients/verify_client", {
        clientId: parseInt(clientId),
      });

      if (!response.status) {
        localStorage.removeItem("accessTokenExp");
        localStorage.removeItem("refreshTokenExp");
        localStorage.removeItem("role");
        localStorage.removeItem("userData");
        if (contextLogout) {
          contextLogout();
        }
        navigate("/login-reg");
      } else {
      }
    } catch (error) {
      localStorage.removeItem("accessTokenExp");
      localStorage.removeItem("refreshTokenExp");
      localStorage.removeItem("role");
      localStorage.removeItem("userData");
      if (contextLogout) {
        contextLogout();
      }
      navigate("/login-reg");
    }
  };

  checkClient();
}, [navigate, contextLogout]);

  // Load initial data: client and projects
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const storedUserData = atob(localStorage.getItem("userData") || "");
        const storedRole = atob(localStorage.getItem("role") || "");
        if (storedUserData && storedRole === "Client") {
          const parsedData = JSON.parse(storedUserData);
          if (parsedData.clientName && parsedData.department && parsedData.degree && parsedData.clientId) {
            setClientData({
              ClientName: parsedData.clientName,
              Profile: parsedData.clientPic || null,
              Designation: parsedData.department,
              Degree: parsedData.degree,
              ClientId: parsedData.clientId,
            });
            await fetchProjects(parsedData.clientId);
          } else {
            throw new Error("Incomplete user data in localStorage");
          }
        } else {
          throw new Error("No valid client data or role in localStorage");
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        setClientData(null);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Join project rooms for real-time updates
  useEffect(() => {
    if (connected && projectDetails.length > 0) {
      projectDetails.forEach((project) => {
        emitEvent("joinProject", project.ProjectId);
      });
    }
  }, [connected, projectDetails, emitEvent]);

   
  useEffect(() => {
const handleMessage = (event: MessageEvent) => {
    if (event.source !== window && event.data?.type === 'navigateToProject' && event.data.state?.item) {
      const { ProjectId } = event.data.state.item;
      navigate(`/projectupload?projectId=${ProjectId}`, {
        state: { ProjectDetails: event.data.state.item, isAdd: false }  // Match your state prop
      });
    }
  }; 
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [navigate]);

// readyForProject (already there, but add log)
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      const projectId = null;  // Null for list
      registration.active?.postMessage({
        type: 'readyForProject',
        projectId
      });
    }).catch(err => console.error('SW ready error:', err));
  }
}, []);

  // NEW: Ref to track if socket listener added (prevents duplicates)
  const listenerAddedRef = useRef(false);

  // UPDATED: Socket listener handler - now async, syncs by fetching single project
  const handleNewMessage = useCallback(async (data: { projectId: string; fromRole: "client" | "head" | "tl"; msg: any }) => {
    const { projectId, fromRole } = data;
    if (fromRole === "client") return; // No change for messages sent by client

    // Find current project to compute old total
    setProjectDetails((prev) => {
      const projectIndex = prev.findIndex((p) => p.ProjectId === projectId);
      if (projectIndex === -1) return prev;

      const oldProject = prev[projectIndex];
      const oldTotalUnread = oldProject.unreadFromHead + oldProject.unreadFromTL;

      // Async fetch and update
      const syncProject = async () => {
        try {
          const timestamp = Date.now();
          const response = await getData(`clientproject/get_project/${projectId}?_t=${timestamp}`);
          if (response.status) {
            const projectData = response.data;
            const { unreadFromHead, unreadFromTL, hasMentionFromHead, hasMentionFromTL, headName, teamLeaderName } = computeUnread(projectData);

            const newTotalUnread = unreadFromHead + unreadFromTL;
            if (newTotalUnread > oldTotalUnread) {
              playNotificationSound();
            }

            setProjectDetails((prevInner) =>
              prevInner.map((p) =>
                p.ProjectId === projectId
                  ? {
                      ...p,
                      unreadFromHead,
                      unreadFromTL,
                      hasMentionFromHead,
                      hasMentionFromTL,
                      headName,
                      teamLeaderName,
                    }
                  : p
              )
            );
          }
        } catch (err) {
          console.error("Error syncing project on new message:", err);
        }
      };

      syncProject();

      return prev; // Return unchanged for now, update will happen after fetch
    });
  }, [playNotificationSound]);

  // UPDATED: Socket listener useEffect (replaces old "newMessage" one)
  useEffect(() => {
    if (!connected || listenerAddedRef.current) return;  // Prevent duplicates on re-renders

    onEvent("newMessage", handleNewMessage);
    listenerAddedRef.current = true;  // Mark as added

    return () => {
      // Cleanup: Remove listener (assume useSocket exposes offEvent; if not, add to hook)
      if (typeof offEvent === 'function') {
        offEvent("newMessage", handleNewMessage);
      }
      listenerAddedRef.current = false;  // Reset for potential re-mount
    };
  }, [connected, onEvent, handleNewMessage, offEvent]);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const scrollToTop = () => {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        document.getElementById("client-profile-root")?.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
      }, 0);
    };
    scrollToTop();
    window.addEventListener("load", scrollToTop);
    return () => {
      window.removeEventListener("load", scrollToTop);
    };
  }, []);

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;

    if (loading) {
    return <PageLoadingComponent />;
  }
  // Check if ProjectDetails is effectively blank
  const isProjectDetailsBlank =
    projectDetails.length === 0 ||
    (projectDetails.length === 1 &&
      projectDetails[0].Workstream === "" &&
      projectDetails[0].Description === "" &&
      projectDetails[0].SubmissionDate === "" &&
      projectDetails[0].status === "");

  // Sort projects: first by total unread (descending), then by status (On-Going first), then by deadline (descending)
const sortedProjectDetails = [...projectDetails].sort((a, b) => {
  const aTotalUnread = a.unreadFromHead + a.unreadFromTL;
  const bTotalUnread = b.unreadFromHead + b.unreadFromTL;
  if (aTotalUnread !== bTotalUnread) {
    return bTotalUnread - aTotalUnread;
  }
  // NEW: Prioritize On-Going over Completed
  if (a.status.toLowerCase() === "on-going" && b.status.toLowerCase() === "completed") return -1;
  if (a.status.toLowerCase() === "completed" && b.status.toLowerCase() === "on-going") return 1;
  return new Date(b.SubmissionDate).getTime() - new Date(a.SubmissionDate).getTime();
});

  // Calculate pagination based on sorted array
  const totalPages = Math.max(
  1,
  Math.ceil(sortedProjectDetails.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = sortedProjectDetails.slice(startIndex, endIndex);

  const maxTextLength = Math.max(
    ...projectDetails.map((item) => item.Workstream.length)
  );

  const widthClass =
    maxTextLength > 30
      ? "w-[300px]"
      : maxTextLength > 20
      ? "w-[250px]"
      : "w-[170px]";

  const handleNavigation = (project: any) => {
    navigate("/projectupload", { state: { ProjectDetails: project } });
  };

  if (!clientData) {
    return <div>Error: Unable to load client profile. Please log in again.</div>;
  }

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

  return (
    <div
      id="client-profile-root"
      className={`flex flex-col justify-center min-h-screen w-full ${
        isXXS || isXS ? "" : isXL || is2XL ? " py-[10vh]" : "py-[10vh]"
      }`}
    >
      <div className={`flex items-center justify-center`}>
        <MainNavigation isMenuHide={false} />
        <div
          className={` w-full ${!isMD?"":"min-h-screen"} ${
            isXXS || isXS || isSM || isMD || isLG ? "" : "flex items-center justify-center"
          } ${isXXS || isXS ? "pt-15 pb-5" : ""} ${
            isXL ? "px-[8vw] gap-15" : is2XL ? "gap-20 px-[8vw]" : isLG || isMD || isSM || isXS || isXXS ? "px-[2vw]" : ""
          }`}
        >
          {/* Left Side: Profile Info */}
          <div
            className={`flex  ${
              isXXS
                ? "flex-col"
                : isXS
                ? "flex-col"
                : isSM || isMD || isLG
                ? "flex-row justify-center gap-x-[5vh]"
                : "flex-col justify-center"
            } items-center w-full ${isXXS || isXS || isSM || isMD || isLG ? "mb-7" : "max-w-xs mb-7"}`}
          >
            <div className="flex flex-col items-center ">
              <div
                className={`items-center flex justify-center ${
                  isXXS || isXS
                    ? "w-[200px] h-[200px]"
                    : isSM
                    ? "w-[200px] h-[200px]"
                    : isMD
                    ? "w-[200px] h-[200px]"
                    : isLG || isXL
                    ? "w-[220px] h-[220px]"
                    : "w-[275px] h-[275px]"
                } rounded-full overflow-hidden border-6 border-gray-300 shadow-md`}
              >
                {clientData.Profile ? (
                  <img
                    src={`${serverURL}/files/${clientData.Profile}`}
                    alt="User Profile"
                    className="w-full h-full p-3 rounded-full object-cover"
                  />
                ) : (
                  <FaUser size={100} color="#10B981" />
                )}
              </div>
              <div className="text-center text-black">
                <div className={`${is2XL ? "text-[36px] mt-2" : isXXS || isXS || isSM ? "text-[27px]" : "text-[36px]"} font-normal`}>
                  {clientData.ClientName}
                </div>
                <p className={`text-gray-700 ${is2XL ? "text-[24px] mt-2" : "text-[24px]"} font-medium`}>
                  {clientData.Designation} <span>({clientData.Degree})</span>
                </p>
              </div>
            </div>
            <div
              className={`flex justify-center items-center flex-col-reverse ${
                isXXS
                  ? ""
                  : isXS
                  ? ""
                  : isSM
                  ? "mb-20"
                  : isMD
                  ? "mb-20"
                  : isLG
                  ? "mb-22"
                  : ""
              }`}
            >
              {!isProjectDetailsBlank && (
                <div
                  onClick={() => handleNavigation({ Workstream: "", Description: "", SubmissionDate: "", status: "" })}
                  className={`
                    ${isXXS || isXS || isSM ? "text-[10px]" : "text-[14px]"}
                    flex
                    cursor-pointer
                    items-center 
                    justify-center 
                    mt-5
                    px-5 
                    py-1.5 
                    bg-blue-600 
                    text-white 
                    font-medium 
                    rounded-lg 
                    shadow-md 
                    hover:bg-blue-700 
                    focus:outline-none 
                    focus:ring-2 
                    focus:ring-offset-2 
                    focus:ring-blue-500
                    transition-all 
                    duration-300 
                    ease-in-out
                  `}
                >
                  <IoAdd className="w-5 h-5 mr-2" />
                  Add Project
                </div>
              )}
              <div
                className={`mt-4 w-fit flex ${isXL || is2XL ? "flex-col" : "flex-row "} gap-4`}
              >
                <Button4 value1={projectOnGoing} value2="On-Going" />
                <Button4 value1={projectCompleted} value2="Completed" />
              </div>
            </div>
          </div>

          {(isXXS || isXS || isSM || isMD || isLG) && (
            <div
              className={`text-black flex items-center justify-center gap-x-4 font-medium ${
                isXXS
                  ? "text-[18px] pt-3 mb-3"
                  : isXS || isSM
                  ? "text-[20px] pt-3 mb-4"
                  : isMD
                  ? "text-[22px] pt-4 mb-5"
                  : isLG
                  ? "text-[24px] mb-6 pt-4"
                  : ""
              }`}
            >
              Project Record {projectStartDate}-{projectEndDate}
              {totalUnread > 0 && (
                    <span className=" bg-green-100 shadow-sm shadow-gray-500 text-black text-xs px-2 py-2 rounded-br-full rounded-tl-full rounded-tr-full">
                     <span className="rounded-full bg-green-400 px-2 text-white py-1 mr-2"> {totalUnread}</span> New
                    </span>
                  )}
            </div>
          )}

          {/* Right Side: Performance Record */}
          <div className="w-full overflow-x-auto">
            <div
              className={`flex min-w-[650px] overflow-x-auto flex-col w-full ${
                isXXS || isXS || isSM || isMD || isLG ? "items-center" : "items-center"
              }`}
            >
              {!isProjectDetailsBlank && (isXL || is2XL) && (
                <div
                  className={`w-full items-center gap-x-7  justify-center flex ${
                    isXL ? "text-[28px] mb-7" : "text-[35px] mb-8"
                  } text-black font-medium mb-6 -tracking-[0.02rem]`}
                >
                  Project Record {projectStartDate}-{projectEndDate}
                  {totalUnread > 0 && (
                    <span className=" bg-green-100 shadow-sm shadow-gray-500 text-black text-[15px] px-4 py-1 rounded-br-full rounded-tl-full rounded-tr-full">
                     <span className="rounded-full bg-green-400 px-2.5 text-white py-1 mr-2"> {totalUnread}</span> New
                    </span>
                  )}
                </div>
              )}
              {!isProjectDetailsBlank &&
                currentItems.map((item, index) => {
                  const totalUnreadForProject = item.unreadFromHead + item.unreadFromTL;
                  return (
                    <div
                      onClick={() => handleNavigation(item)}
                      className={`flex cursor-pointer justify-start items-start ${
                        index === currentItems.length - 1 ? "mt-3" : "my-3"
                      } w-full flex-col`}
                      key={item.ProjectId}
                    >
                      <div className="flex flex-col-reverse items-start justify-start w-full">
                        <div className="flex items-start justify-between w-full">
                          <Button1
                            width={widthClass}
                            gradientType={item.status === "Completed" ? "" : "gradient1"}
                            text={`${is2XL ? "text-[15px]" : "text-[12px]"} `}
                            value={item.Workstream}
                          />
{totalUnreadForProject > 0 && !dismissedNotifications.has(item.ProjectId) && (
  <div className="relative w-fit max-w-xs ml-2">
    <div className="relative flex space-x-3 space-y-1 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-md">

      {/* Pointer Triangle */}
      <div className="absolute -bottom-[11px] left-[3px] w-0 h-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-blue-200"></div>
      <div className="absolute -bottom-[9px] left-[4px] w-0 h-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-blue-50"></div>

      {/* Close Button */}
       <MdCancel
           size={22}
        onClick={(e) => {
          e.stopPropagation();
          setDismissedNotifications((prev) => new Set([...prev, item.ProjectId]));
        }}
        className="absolute top-1.5 right-0 text-gray-400 hover:text-red-500 
                   hover:bg-red-100 rounded-full p-0.5 
                   transition-all duration-200 cursor-pointer"
      />

      {/* Count badge */}
      <span className="flex items-center justify-center w-7 h-7 text-sm font-bold text-white bg-green-500 rounded-full self-start">
        {totalUnreadForProject}
      </span>

      {/* Text content — pr-4 so text doesn't run under the close button */}
      <div className="flex flex-col space-y-1.5 pr-4">
        {item.hasSOWFromHead && (
          <div className="flex items-center space-x-1.5">
            <IconAt />
            <span className="text-xs text-blue-700 font-medium">Head send SOW</span>
          </div>
        )}
        {item.hasMentionFromHead && (
          <div className="flex items-center space-x-1.5">
            <IconAt />
            <span className="text-xs text-blue-700 font-medium">Head tagged you.</span>
          </div>
        )}
        {item.hasMentionFromTL && (
          <div className="flex items-center space-x-1.5">
            <IconAt />
            <span className="text-xs text-blue-700 font-medium">Team Leader tagged you.</span>
          </div>
        )}
        {item.unreadFromHead > 0 && !item.hasMentionFromHead && !item.hasSOWFromHead && (
          <div className="flex items-center space-x-1.5">
            <IconChat />
            <span className="text-xs text-gray-700">
              New message{item.unreadFromHead > 1 ? "s" : ""} from Head
            </span>
          </div>
        )}
        {item.unreadFromTL > 0 && !item.hasMentionFromTL && (
          <div className="flex items-center space-x-1.5">
            <IconChat />
            <span className="text-xs text-gray-700">
              New message{item.unreadFromTL > 1 ? "s" : ""} from TL
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
)}

                        </div>
                        <div className="border-t-2 border-[#000000] w-full"></div>
                      </div>
                      <div
  className={`flex mt-3 w-full pl-[2vw] justify-between items-center ${
    item.status.toLowerCase() === "completed" ? "text-[#474747]" : "text-[#000000]"
  } `}
>
                       <div
    className={`w-[35%] text-start flex font-normal ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
  >
    {item.Title}
  </div>
  <div
    className={`font-normal flex justify-center w-[35%] ${is2XL ? "text-[15px]" : "text-[12px]"} -tracking-[0.02rem]`}
  >
    Submission Date: {new Date(item.SubmissionDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })}
  </div>
                        <div
    className={`w-[30%] justify-center font-normal text-[12px] -tracking-[0.02rem] flex items-center`}
  >
    {/* NEW: Clean status labels */}
    {item.status === "On-Going" ? "ON-GOING" : "COMPLETED"}
  </div>
                      </div>
                    </div>
                  );
                })}
              {isProjectDetailsBlank && (
                <div className="
                  flex 
                  flex-col 
                  items-center 
                  justify-center 
                  p-10 
                  bg-white 
                  border-2 
                  border-dashed 
                  border-gray-300 
                  rounded-xl 
                  shadow-sm 
                  text-center
                  w-full
                  max-w-md
                  mx-auto
                ">
                  <div className="
                    flex 
                    items-center 
                    justify-center 
                    w-20 
                    h-20 
                    mb-6 
                    bg-blue-100 
                    rounded-full
                  ">
                    <BsArchive className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                    No Project submitted yet
                  </h2>
                  <p className="text-slate-500 mb-8">
                    Get started by adding your first project.
                  </p>
                  <div
                    onClick={() => handleNavigation({ Workstream: "", Description: "", SubmissionDate: "", status: "" })}
                    className="
                      flex 
                      cursor-pointer
                      items-center 
                      justify-center 
                      px-5 
                      py-2.5 
                      bg-blue-600 
                      text-white 
                      font-medium 
                      rounded-lg 
                      shadow-md 
                      hover:bg-blue-700 
                      focus:outline-none 
                      focus:ring-2 
                      focus:ring-offset-2 
                      focus:ring-blue-500
                      transition-all 
                      duration-300 
                      ease-in-out
                    "
                  >
                    <IoAdd className="w-5 h-5 mr-2" />
                    Add Project
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {!isProjectDetailsBlank && (
        <div className={`w-full ${isXXS || isXS || isMD || isLG?"my-10":"mt-10"}  flex justify-center items-center`}>
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

export default ClientProfile;