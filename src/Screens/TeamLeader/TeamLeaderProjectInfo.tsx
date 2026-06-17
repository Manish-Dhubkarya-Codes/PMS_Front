import React, { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import Button1 from "../../UI_Components/Buttons/Button1";
import Button2 from "../../UI_Components/Buttons/Button2";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import MikeSearch from "../../UI_Components/SearchBars/MikeSearch";
import EmployeeSearchBar from "../../UI_Components/SearchBars/EmployeeSearch";
import ProfileWithDesignation from "../../UI_Components/Profile/ProfileWithDesignation";
import UserIcon from "../../assets/CredientialAssets/UserLogo.png";
import { Commet } from "react-loading-indicators";
import { BiSolidSelectMultiple } from "react-icons/bi";
import {
  FaFileAudio,
  FaFileImage,
  FaFileInvoice,
  FaFileVideo,
  FaRegFileAlt,
  FaBars,
  FaTimes,
  FaFileArchive,
  FaFileWord,
  FaInfoCircle,
} from "react-icons/fa";
import { FaFilePdf } from "react-icons/fa6";

import { useLocation } from "react-router-dom";
import { FiDownload, FiX, FiZoomIn } from "react-icons/fi";
import { RiTimeLine } from "react-icons/ri";
import { TbListDetails } from "react-icons/tb";
import {
  serverURL,
  postData,
  getData,
} from "../../BackendConnections/FetchBackendServices";
import { IoCheckmarkDoneSharp } from "react-icons/io5";
import useSound from "use-sound";
import notificationSound from "../../assets/CredientialAssets/Chat_Notification_Sound.mp3";
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from "../../BackendConnections/useSocket";
// import { useGlobalPush } from "../../hooks/useGlobalPush";
import { MdOutlineDoubleArrow, MdOutlineReply, MdEdit, MdDelete, MdBlock } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";
import ProgressTracking from "../../UI_Components/Progresses/ProgressTracking";
interface ChatMessage {
  type: "text" | "file";
  isLeft: boolean;
  fromClient: boolean;
  fromHead: boolean;
  fromTeamLeader: boolean;
  message?: string;
  file?: { url: string; name: string; type: string; blob?: Blob };
  timestamp: string;
  seen_by: string[];
  id?: number;
  mention?: { type: "client" | "head"; id: string; name: string; imageUrl?: string } | null;
  tempId?: string; // For optimistic updates
  replyTo?: ReplyMessage | null;
  edited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  caption?: string;
}
interface ReplyMessage {
  // New: For reply context
  id: number;
  sender: string; // e.g., "Client", "Team Leader"
  content: string; // Truncated original message or file name
  type: "text" | "file";
  timestamp: string;
}
interface ProjectDetails {
  project_id: string;
  workstream: string;
  title: string;
  deadline: string;
  description: string | string[];
  clientName?: string;
  clientPic?: string;
  headPic?: string;
  headName?: string;
  clientchats?: string[];
  clientaudios?: string[];
  headchats?: string[];
  headaudios?: string[];
  tlchats?: string[];
  tlaudios?: string[];
  assignedEmployees?: string;
  clientid?: string;
  headid?: string;
  status?: string;
}
interface File {
  url: string;
  name: string;
  type: string;
}
interface MentionOption {
  label: string;
  value: string;
  type: "client" | "head";
  id: string;
  name: string;
  imageUrl?: string;
}
interface Employee {
  employeeId: string;
  employeeName: string;
  employeePic: string | null;
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
interface UpdateItem {
  number: number;
  title: string;
  messageTimestamp: string;
  isText: boolean;
}
const TeamLeaderProjectInfo: React.FC = () => {
  const [updatesList, setUpdatesList] = useState<UpdateItem[]>([]);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [previewHeight, setPreviewHeight] = useState<number>(0);
  const [currentTab, setCurrentTab] = useState<"chat" | "files">("chat");
  const [newMessage, setNewMessage] = useState<string>("");
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const autoScrollRef = useRef<boolean>(true);
  const prevMessagesLengthRef = useRef(0);
  const [msgControl, setMsgControl] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [playNotification] = useSound(notificationSound);
  const location = useLocation();
  const { item } = location.state || {};
  const storedUserData = localStorage.getItem("userData");
    const isCompleted = projectDetails?.status === "Completed";
  const parsedData = storedUserData ? JSON.parse(atob(storedUserData)) : null;
  const designation = parsedData.employeeDesignation;
        const deptMatch = designation.match(/\(([^)]+)\)$/);
        const dept = deptMatch ? deptMatch[1].trim() : null;
  // const storedUserRole = localStorage.getItem("role") ? atob(localStorage.getItem("role")!) : "";
  const [width, setWidth] = useState(window.innerWidth);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeStatuses, setEmployeeStatuses] = useState<{ [key: string]: string }>({});
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<AllEmployee[]>([]);
  const [selectedDesignation, setSelectedDesignation] = useState<string>("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [errorRequests, setErrorRequests] = useState<string | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const observer = useRef<IntersectionObserver | null>(null);
  const { socket, connected, onEvent } = useSocket();
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
const [headId, setHeadId] = useState<string>("");
const [headName, setHeadName] = useState<string>("");
const [headPic, setHeadPic] = useState<string>("");
const [replyToMessage, setReplyToMessage] = useState<ReplyMessage | null>(null);
const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
const [messageMenuIndex, setMessageMenuIndex] = useState<number | null>(null);
const [isUpdatesLoading, setIsUpdatesLoading] = useState(true);
const [isFileSelectionMode, setIsFileSelectionMode] = useState(false);
const [selectedFileTimestamps, setSelectedFileTimestamps] = useState<Set<string>>(new Set());
const [progress, setProgress] = useState({ start: 'no', payment: '0%', work: '0%' });
const [isAssigning, setIsAssigning] = useState(false);
  useEffect(() => {
  const fetchHeadData = async () => {
    try {
      const headResponse = await getData("head/fetch_head_data");
      if (headResponse && headResponse.data) {
        setHeadId(headResponse.data.headId || "");
        setHeadName(headResponse.data.headName || "");
        setHeadPic(headResponse.data.headPic || "");
      }
    } catch (error) {
      console.error("Error fetching head data:", error);
    }
  };
  fetchHeadData();
}, []);

const handleReplyToMessage = (msg: ChatMessage) => {
  const sender = msg.fromClient ? "Client" : msg.fromHead ? "Head" : "Team Leader";
  const content = msg.type === "text" ? (msg.message?.substring(0, 50) + (msg.message && msg.message.length > 50 ? "..." : "")) : msg.file?.name || "File";
  setReplyToMessage({
    id: msg.id ?? -1,
    sender,
    content,
    type: msg.type,
    timestamp: msg.timestamp,
  });
};

const toggleFileSelect = (timestamp: string) => {
  setSelectedFileTimestamps((prev) => {
    const next = new Set(prev);
    next.has(timestamp) ? next.delete(timestamp) : next.add(timestamp);
    return next;
  });
};

const getRelativeUrl = (fullUrl: string): string => {
  let rel = fullUrl.replace(serverURL, "").replace(/^\/+/, "/");
  if (!rel.startsWith("/files/")) {
    const filename = fullUrl.split("/").pop() || "";
    rel = `/files/${filename}`;
  }
  return rel;
};

const forwardFiles = async (timestamps: string[]) => {
  if (!projectDetails?.project_id || !socket || !connected) return;

  const projId = projectDetails.project_id;
  const teamleaderid = parsedData?.employeeId;

  let forwardedCount = 0;

  for (const ts of timestamps) {
    const msg = chatMessages.find((m) => m.timestamp === ts && m.type === "file" && m.file);
    if (!msg?.file) continue;

    const msgData = {
      name: msg.file.name,
      url: getRelativeUrl(msg.file.url),
      type: msg.file.type,
    };

    try {
      await postData(`clientproject/add_tl_chat_to_monitor/${projId}`, {
        type: "file",
        data: msgData,
        timestamp: new Date().toISOString(),
        teamleaderid,
      });

      forwardedCount++;

      // 🔥 CRITICAL: Emit the same event that sub-chat listens to
      socket.emit("newTLMonitorMessage", {
        fromRole: "tl",
        msg: {
          id: Date.now(),                    // temporary id
          type: "file",
          data: msgData,
          timestamp: new Date().toISOString(),
          seen_by: [],
          replyTo: null,
        },
      });

    } catch (err) {
      console.error("Forward failed", err);
    }
  }

  if (forwardedCount > 0) {
    playNotification();
  }

  setSelectedFileTimestamps(new Set());
  setIsFileSelectionMode(false);
};
useEffect(() => {
  const fetchProgress = async () => {
    if (projectDetails?.project_id) {
      try {
        const progressData = await getData(`clientproject/get_progress/${projectDetails.project_id}`);
        if (progressData.status) {
          setProgress(progressData.progress);
        }
      } catch (err) {
        console.error("Error fetching progress:", err);
      }
    }
  };
  fetchProgress();
}, [projectDetails]);

const handleStepClick = async (index: any) => {
  const nextPercent = (index + 1) * 20 + '%';
  if (window.confirm(`Update the work progress to ${nextPercent}`)) {
    try {
      const res = await postData(`clientproject/update_progress/${projectDetails?.project_id}`, { type: 'work' });
      if (res.status) {
        setProgress(res.progress);
      }
    } catch (err) {
      console.error("Error updating progress:", err);
    }
  }
};

const handleClickOnReplyBubble = (reply: ReplyMessage) => {
  const repliedMsg = chatMessages.find((m) => m.timestamp === reply.timestamp);
  if (repliedMsg) {
    const index = chatMessages.indexOf(repliedMsg);
    const el = messageRefs.current[`${index}`];
    if (el) {
      chatContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      el.scrollIntoView({ block: "center" });
      el.style.transition = "none";
      el.style.backgroundColor = "#636363";
      el.offsetHeight;
      setTimeout(() => {
        el.style.transition = "background-color 3s ease-out";
        el.style.backgroundColor = "transparent";
      }, 1000);
    }
  }
};

const detectMention = (message: string): ChatMessage["mention"] | null => {
  const mentionMatch = message.match(/@(\S+)/i);
  if (!mentionMatch) return null;
  const mentionText = mentionMatch[1].trim();
  const clientNameTrimmed = (projectDetails?.clientName || '').trim().toLowerCase();
  const headNameTrimmed = headName.trim().toLowerCase();
  if (mentionText.toLowerCase() === clientNameTrimmed) {
    return {
      type: "client",
      id: (projectDetails?.clientid || '').toString(),
      name: projectDetails?.clientName || '',
    };
  } else if (mentionText.toLowerCase() === headNameTrimmed) {
    return {
      type: "head",
      id: headId,
      name: headName,
    };
  }
  return null;
};
  const handleMentionSelect = (option: MentionOption) => {
    if (inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      const before = newMessage.substring(0, cursorPos).replace(/@[^@]*$/, "");
      const after = newMessage.substring(cursorPos);
      const newValue = `${before}${option.value} ${after}`;
      setNewMessage(newValue);
   
      inputRef.current.focus();
      const newCursorPos = before.length + option.value.length + 1; // +1 for space
      setTimeout(() => {
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      const before = newMessage.substring(0, cursorPos);
      const mentionMatch = before.match(/@(\w+(?:\s\w+)?)\s?$/);
      if (mentionMatch) {
        const mentionText = mentionMatch[0];
        const newBefore = before.substring(0, before.length - mentionText.length);
        const after = newMessage.substring(cursorPos);
        setNewMessage(`${newBefore}${after}`);
        e.preventDefault();
      }
    }
  };

  const mentionOptions: MentionOption[] = [
  ...(projectDetails?.clientName
    ? [
        {
          label: `Client: ${projectDetails.clientName}`,
          value: `@${projectDetails.clientName}`,
          type: "client" as const,
          id: projectDetails.clientid || "",
          name: projectDetails.clientName,
          imageUrl: projectDetails.clientPic ? `${serverURL}/files/${projectDetails.clientPic}` : UserIcon,
        },
      ]
    : []),
  ...(headName
    ? [
        {
          label: `Head: ${headName}`,
          value: `@${headName}`,
          type: "head" as const,
          id: headId || "",
          name: headName,
          imageUrl: headPic ? `${serverURL}/files/${headPic}` : UserIcon,
        },
      ]
    : []),
];

const processUpdates = (messages: ChatMessage[]) => {
  const tempUpdates: (Omit<UpdateItem, "number"> & { parsedNumber?: number })[] = [];

  messages.forEach((msg) => {
    if (msg.fromClient && msg.type === "text" && msg.message?.startsWith("@update_")) {
      let title: string;
      const newMatch = msg.message.match(/@update_([^:]+):(.*)/s);
      if (newMatch) {
        title = newMatch[1].trim();
      } else {
        return;
      }
      tempUpdates.push({
        title,
        messageTimestamp: msg.timestamp,
        isText: true,
      });
    } else if (msg.fromClient && msg.type === "file" && msg.file?.name.startsWith("@update_")) {
      const name = msg.file.name;
      let title: string;
      if (name.endsWith(".pdf")) {
        const safeTitle = name.slice(8, -4);
        title = safeTitle
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      } else {
        return;
      }
      tempUpdates.push({
        title,
        messageTimestamp: msg.timestamp,
        isText: false,
      });
    }
  });

  const sortedUpdates = tempUpdates
    .sort((a, b) => new Date(a.messageTimestamp).getTime() - new Date(b.messageTimestamp).getTime())
    .map((update, index) => ({
      ...update,
      number: index + 1,
    }));

  setUpdatesList(sortedUpdates as UpdateItem[]);
};

useEffect(() => {
  processUpdates(chatMessages);
  setIsUpdatesLoading(false);
}, [chatMessages]);

  const highlightUpdate = (updateItem: UpdateItem) => {
    const msg = chatMessages.find(
      (m) => m.timestamp === updateItem.messageTimestamp
    );
    if (msg) {
      const currentIndex = chatMessages.indexOf(msg);
      const el = messageRefs.current[`${currentIndex}`];
      if (el) {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
        el.scrollIntoView({ block: "center" });

        // Apply highlight instantly without transition
        el.style.transition = "none";
        el.style.backgroundColor = "#636363";
        el.offsetHeight; // Force reflow to apply styles immediately

        setTimeout(() => {
          el.style.transition = "background-color 3s ease-out";
          el.style.backgroundColor = "transparent"; // Or set to your original background color, e.g., "#ffffff" if it's white
        }, 1000);
      }
    }
  };
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  useEffect(() => {
    function handleClickOutside(e: TouchEvent | MouseEvent) {
      if (divRef.current && !divRef.current.contains(e.target as Node)) {
        setMsgControl(null);
      }
    }
    function handleScrollOrMove() {
      setMsgControl(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("scroll", handleScrollOrMove, true);
    document.addEventListener("touchmove", handleScrollOrMove);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("scroll", handleScrollOrMove, true);
      document.removeEventListener("touchmove", handleScrollOrMove);
    };
  }, []);
  // TL edit/delete socket listeners
  useEffect(() => {
    if (!socket) return;
    const handleEdited = (data: { projectId: string; index: number; newData: string; editedAt: string }) => {
      if (data.projectId !== projectDetails?.project_id) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === data.index && m.fromTeamLeader
            ? { ...m, message: data.newData, edited: true, editedAt: data.editedAt }
            : m
        )
      );
    };
    const handleDeleted = (data: { projectId: string; index: number; deletedAt: string }) => {
      if (data.projectId !== projectDetails?.project_id) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === data.index && m.fromTeamLeader
            ? { ...m, isDeleted: true, deletedAt: data.deletedAt, message: undefined, file: undefined }
            : m
        )
      );
    };
    socket.on("tlMessageEdited", handleEdited);
    socket.on("tlMessageDeleted", handleDeleted);
    return () => {
      socket.off("tlMessageEdited", handleEdited);
      socket.off("tlMessageDeleted", handleDeleted);
    };
  }, [socket, projectDetails?.project_id]);

  const fetchProject = async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const response = await getData(`clientproject/get_project/${item.project_id}`);
      if (response.status) {
        setProjectDetails(response.data);
      }
    } catch (error) {
      console.error("Error fetching project data:", error);
    } finally {
      if (!isPolling) setLoading(false);
    }
  };
  useEffect(() => {
    if (item?.project_id) {
      fetchProject();
    } else {
      setProjectDetails(item);
    }
  }, [item]);

  


  useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      fetchProject(true); // Refetch chats when page becomes visible (e.g., switch back)
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);

  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [fetchProject]);

  useEffect(() => {
    if (socket) {
      onEvent("newMessage", (data: { fromRole: string; msg: any }) => {
        const { fromRole, msg: incoming } = data;
        setChatMessages((prev) => {
          const isDuplicate = prev.some((m) =>
            m.timestamp === incoming.timestamp &&
            ((m.type === "text" && m.message === incoming.data) ||
             (m.type === "file" && m.file?.name === incoming.data.name))
          );
          if (isDuplicate) {
            return prev;
          }
          const existingIndex = prev.findIndex(
            (m) => m.tempId === incoming.tempId
          );
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              id: incoming.id,
              tempId: undefined,
            };
            return updated.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          } else {
            const fromClient = fromRole === "client";
            const fromHead = fromRole === "head";
            const fromTeamLeader = fromRole === "tl";
            const isLeft = fromClient || fromHead; // For TL view: client and head are left
            const newMsg: ChatMessage = {
              type: incoming.type === "text" ? "text" : "file",
              isLeft,
              fromClient,
              fromHead,
              fromTeamLeader,
              timestamp: incoming.timestamp,
              seen_by: incoming.seen_by,
              id: incoming.id,
              mention: incoming.mention,
              replyTo: incoming.replyTo || null,
            };
            if (incoming.type === "text") {
              newMsg.message = incoming.data;
            } else {
              newMsg.file = {
                name: incoming.data.name,
                url: `${serverURL}${incoming.data.url}`,
                type: incoming.data.type,
              };
              newMsg.caption = incoming.caption || undefined;
            }
            const updated = [...prev, newMsg].sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            );
            return updated;
          }
        });
          playNotification();
      });
    }
  }, [socket, playNotification]);

useEffect(() => {
  if (socket && connected && projectDetails?.project_id) {
    socket.emit("joinProject", projectDetails.project_id);

    const handleNewMessage = (data: { projectId: string; fromRole: string; msg: ChatMessage }) => {
      if (data.projectId !== projectDetails?.project_id) return;

      const { fromRole, msg } = data;
      let newMsg: ChatMessage = {
        type: msg.type,
        timestamp: msg.timestamp,
        seen_by: msg.seen_by || [],
        id: msg.id,
        mention: msg.mention || null,
        replyTo: msg.replyTo || null, // Ensure replyTo is handled
        tempId: msg.tempId,
        isLeft: fromRole !== "tl", // TL's own messages on right
        fromClient: fromRole === "client",
        fromHead: fromRole === "head",
        fromTeamLeader: fromRole === "tl",
        message: msg.type === "text" ? msg.message : undefined,
        file: msg.type === "file" ? msg.file : undefined,
        caption: msg.caption || undefined,
      };

      setChatMessages((prev) => {
        if (fromRole === "tl" && msg.tempId) {
          // Update optimistic message with real ID for TL's own reply
          return prev.map((m) =>
            m.tempId === msg.tempId ? { ...m, id: msg.id, replyTo: msg.replyTo, caption: msg.caption || undefined } : m
          );
        } else {
          // Add new message from client/head
          playNotification(); // Play sound for incoming
          return [...prev, newMsg];
        }
      });

      // Update updates list if needed
      processUpdates([...chatMessages, newMsg]);
    };

    socket.on("newMessage", handleNewMessage);

    // Cleanup
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }
}, [socket, connected, projectDetails, chatMessages, playNotification]);


   useEffect(() => {
  onEvent("messageSeen", (data) => {
    console.log("Received messageSeen data:", data);
    let fromClient = false;
    let fromHead = false;
    let fromTeamLeader = false;
    let index = data.index; // Fallback to index if available
    let seen_by = data.seen_by;
    let timestamp = data.timestamp; // Primary matcher: use timestamp from backend emit
    if (data.fromRole) {
      fromClient = data.fromRole === "client";
      fromHead = data.fromRole === "head";
      fromTeamLeader = data.fromRole === "tl";
    } else {
      fromClient = data.fromClient || false;
      fromHead = data.fromHead || false;
      fromTeamLeader = data.fromTeamLeader || false;
    }
    setChatMessages((prev) => {
      // Find target using timestamp + flags (primary) or index + flags (fallback)
      const targetMessage = prev.find(m =>
        (m.timestamp === timestamp && m.fromClient === fromClient && m.fromHead === fromHead && m.fromTeamLeader === fromTeamLeader) ||
        (m.id === index && m.fromClient === fromClient && m.fromHead === fromHead && m.fromTeamLeader === fromTeamLeader)
      );
      if (!targetMessage) {
        console.log("No matching message found for update");
        return prev;
      }
      const updated = prev.map((m) =>
        (m.timestamp === timestamp && m.fromClient === fromClient && m.fromHead === fromHead && m.fromTeamLeader === fromTeamLeader) ||
        (m.id === index && m.fromClient === fromClient && m.fromHead === fromHead && m.fromTeamLeader === fromTeamLeader)
          ? { ...m, seen_by }
          : m
      );
      console.log("Updated seen_by for message:", updated.find(m =>
        (m.timestamp === timestamp && m.fromClient === fromClient && m.fromHead === fromHead && m.fromTeamLeader === fromTeamLeader) ||
        (m.id === index)
      )?.seen_by);
      return updated;
    });
  });
}, [onEvent]);
  useEffect(() => {
    if (projectDetails?.project_id) {
      getData(`employees/fetch_employee_by_projectid/${projectDetails.project_id}`).then((response) => {
        if (response) {
          setEmployeesList(response.data.employees || []);
        }
      }).catch((error) => {
        console.error("Error fetching project employees:", error);
      });
    }
  }, [projectDetails?.project_id]);
const fetchAllEmployees = async () => {
  if (item?.project_id && item.project_id !== "N/A") {
    setIsLoadingRequests(true); // Start loading
    setErrorRequests(null); // Clear any previous errors
    try {
      const response = await getData(
        `employees/fetch_all_employees?project_id=${item.project_id}`
      );
      if (response.status) {
        setAllEmployees(response.data);
      } else {
        setErrorRequests(response.message || "Failed to fetch all employees"); // Set error if no success
      }
    } catch (error) {
      console.error("Error fetching all employees:", error);
      setErrorRequests("Error fetching all employees. Please try again."); // Set error on exception
    } finally {
      setIsLoadingRequests(false); // Always stop loading
    }
  }
};
const fetchEmployeesList = async () => {
  if (projectDetails?.project_id) {
    setIsLoadingRequests(true); // Start loading
    setErrorRequests(null); // Clear any previous errors
    try {
      const response = await getData(`employees/fetch_employee_by_projectid/${projectDetails.project_id}`);
      if (response) {
        setEmployeesList(response.data.employees || []);
      } else {
        setErrorRequests("Failed to fetch project employees"); // Set error if no response
      }
    } catch (error) {
      console.error("Error fetching project employees:", error);
      setErrorRequests("Error fetching project employees. Please try again."); // Set error on exception
    } finally {
      setIsLoadingRequests(false); // Always stop loading
    }
  }
};
  useEffect(() => {
    fetchAllEmployees(); // Initial fetch
  }, [item?.project_id]);

  useEffect(() => {
  if (socket) {
    const handleEmployeeAssigned = (data: { projectId: string; employeeIds?: string[] }) => {
      if (data.projectId === projectDetails?.project_id || data.projectId === item?.project_id) {
        fetchAllEmployees(); // Refetch with loading/error handling
        fetchEmployeesList(); // Refetch with loading/error handling
      }
    };
    onEvent("employeeAssigned", handleEmployeeAssigned);
    return () => {
      // Cleanup if needed
    };
  }
}, [socket, projectDetails?.project_id, item?.project_id, onEvent]);

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;
  const employees = employeesList.map((emp) => ({
    EmployeeName: emp.employeeName || "Unknown",
    EmployeeProfile: emp.employeePic,
    isSmall: true,
    employeeId: emp.employeeId,
    requestId: emp.request_id,
    status: employeeStatuses[emp.employeeId] || emp.status,
  }));
  const handleCheckboxChange = (employeeId: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };
const handleAssignSelected = async () => {
  if (selectedEmployeeIds.length === 0 || isAssigning) return;

  setIsAssigning(true);   // ← Loading start

  const assignedIds = [...selectedEmployeeIds];

  try {
    for (const employeeId of assignedIds) {
      const response = await postData("clientproject/submit_request", {
        project_id: item.project_id,
        employeeId: employeeId,
        status: "TLAssign",
      });

      if (response.status) {
        setEmployeesList(prev => [
          ...prev,
          {
            employeeId: employeeId,
            employeeName: allEmployees.find(emp => emp.employeeId === employeeId)?.employeeName || "Unknown",
            employeePic: allEmployees.find(emp => emp.employeeId === employeeId)?.employeePic || null,
            request_id: response.data.request_id,
            status: "TLAssign",
          },
        ]);
        setEmployeeStatuses(prev => ({
          ...prev,
          [employeeId]: "TLAssign",
        }));
        setAllEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
      }
    }

    setSelectedEmployeeIds([]);

    if (socket && connected) {
      socket.emit("employeeAssigned", {
        projectId: item.project_id,
        employeeIds: assignedIds,
      });
    }
  } catch (error) {
    console.error("Error assigning selected employees:", error);
    alert("Some employees could not be assigned. Please try again.");
  } finally {
    setIsAssigning(false);   // ← Loading end
  }
};

  const handleMakeMonitor = async (employeeId: string, projectId: string) => {
    try {
      const response = await postData("clientproject/assign_project_monitor", {
        employeeId,
        projectId,
        status: "Project Monitor",
      });
      if (response.status) {
        alert("Employee assigned as Project Monitor successfully!");
        // Optionally, update state or refresh data
        // For example, you can fetch project requests again or update local state
      } else {
        alert(response.message || "Failed to assign as monitor.");
      }
    } catch (error) {
      console.error("Error assigning monitor:", error);
      alert("Error assigning monitor. Please try again.");
    }
  };

const highlightMessageText = (text: string, mention: ChatMessage["mention"]) => {
  if (!text) return text;

  let highlighted = text;

  // === ROBUST HIGHLIGHTING FOR @Head and @Client (works even if mention object is missing/broken) ===
  // This runs ALWAYS, regardless of msg.mention – fixes the current bug where manual @Head is not colored
  if (projectDetails?.headName) {
    const headMentionStr = `@${projectDetails.headName}`;
    highlighted = highlighted.replace(
      new RegExp(escapeRegExp(headMentionStr), "gi"),  // ignore case (so @himanshu verma also matches)
      `<span style="color: #2934E3; font-weight: 600;">${headMentionStr}</span>`
    );
  }

  if (projectDetails?.clientName) {
    const clientMentionStr = `@${projectDetails.clientName}`;
    highlighted = highlighted.replace(
      new RegExp(escapeRegExp(clientMentionStr), "gi"),
      `<span style="color: #2934E3; font-weight: 600;">${clientMentionStr}</span>`
    );
  }

  // Keep existing logic for when mention object exists (rarely needed now, but safe)
  if (mention) {
    const mentionStr = `@${mention.name}`;
    highlighted = highlighted.replace(
      new RegExp(escapeRegExp(mentionStr), "gi"),
      `<span style="color: #2934E3; font-weight: 600;">${mentionStr}</span>`
    );
  }

  // Existing @update highlighting (unchanged)
 highlighted = highlighted.replace(
      /(@update_[^:\n]+:)/g,
      '<span style="color: #4DD60B; font-weight: 500;">$1</span>'
    );


  return highlighted;
};

  // NEW: Added handleRemoveMonitor function (place it after handleMakeMonitor)
const handleRemoveMonitor = async (employeeId: string, projectId: string) => {
  try {
    const response = await postData("clientproject/remove_project_monitor", {
      employeeId,
      projectId,
      status: "Project Monitor",
    });
    if (response.status) {
      alert("Employee removed as Project Monitor successfully!");
      // Refresh lists
      fetchEmployeesList();
    } else {
      alert(response.message || "Failed to remove monitor.");
    }
  } catch (error) {
    console.error("Error removing monitor:", error);
    alert("Error removing monitor. Please try again.");
  }
};

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
  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const idx = target.dataset.idx;
            if (idx) {
              const msg = chatMessages[parseInt(idx)];
              const viewer = "tl";
              if (msg && msg.isLeft && !msg.seen_by.includes(viewer) && msg.id !== undefined) {
                if (!requiresPreview(msg)) {
                  markMessageAsSeen(msg);
                }
              }
            }
          }
        });
      },
      { threshold: 0.5 }
    );
    return () => observer.current?.disconnect();
  }, [chatMessages, projectDetails?.project_id, onEvent]);
  useEffect(() => {
    const currentObserver = observer.current;
    if (currentObserver) {
      currentObserver.disconnect();
      chatMessages.forEach((msg, idx) => {
        if (msg.isLeft) {
          const el = messageRefs.current[`${idx}`];
          if (el instanceof HTMLElement) {
            el.dataset.idx = idx.toString();
            currentObserver.observe(el);
          }
        }
      });
    }
  }, [chatMessages]);
  const requiresPreview = (msg: ChatMessage) => {
    if (msg.type === "text") return false;
    if (!msg.file?.type) return false;
    const ft = msg.file.type;
    if (ft.startsWith("audio/") || ft.startsWith("video/")) return false;
    return true;
  };
const markMessageAsSeen = async (msg: ChatMessage) => {
  if (!projectDetails?.project_id || msg.id === undefined) return;
  let messageType = msg.type === "file" && msg.file?.type.startsWith("audio/") ? "audio" : "chat";
  const viewer = "tl";
  try {
    const response = await postData(`clientproject/mark_message_seen/${projectDetails.project_id}`, {
      index: msg.id,
      fromClient: msg.fromClient,
      fromHead: msg.fromHead,
      fromTeamLeader: msg.fromTeamLeader,
      type: messageType,
      viewer,
      timestamp: msg.timestamp // Ensure timestamp is sent for backend emit
    });
    if (response.status) {
      // Optimistic local update using timestamp + flags for matching
      setChatMessages((prev) =>
        prev.map((m) =>
          (m.timestamp === msg.timestamp && m.fromClient === msg.fromClient && m.fromHead === msg.fromHead && m.fromTeamLeader === msg.fromTeamLeader) ||
          (m.id === msg.id && m.fromClient === msg.fromClient && m.fromHead === msg.fromHead && m.fromTeamLeader === msg.fromTeamLeader)
            ? { ...m, seen_by: [...new Set([...m.seen_by, viewer])] }
            : m
        )
      );
    }
  } catch (error) {
    console.error("Error marking message as seen:", error);
  }
};
  const getSeenText = (msg: ChatMessage) => {
    if (msg.seen_by.length === 0) return "Not seen yet";
    let text = "Seen by ";
    if (msg.seen_by.includes("client")) text += `Client (${projectDetails?.clientName || "Client"}), `;
    if (msg.seen_by.includes("head")) text += `Head (${projectDetails?.headName || "Head"})`;
    if (text.endsWith(", ")) text = text.slice(0, -2);
    return text;
  };
  const isAllSeen = (msg: ChatMessage) => {
    return (
      msg.seen_by.includes("client") &&
      msg.seen_by.includes("head")
    );
  };
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
  if (chatContainerRef.current) {
    if (autoScrollRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      setShowScrollToBottom(false); // Hide icon on auto-scroll
    }
  }
  if (chatMessages.length > prevMessagesLengthRef.current) {
    autoScrollRef.current = true;
    prevMessagesLengthRef.current = chatMessages.length;
  }
}, [chatMessages, loading]);

useEffect(() => {
  const chatContainer = chatContainerRef.current;
  const handleScroll = () => {
    if (chatContainer) {
      const isNearBottom =
        chatContainer.scrollHeight -
        chatContainer.scrollTop -
        chatContainer.clientHeight <
        100;
      autoScrollRef.current = isNearBottom;
      setShowScrollToBottom(!isNearBottom); // Show icon if not near bottom
    }
  };
  chatContainer?.addEventListener("scroll", handleScroll);
  return () => chatContainer?.removeEventListener("scroll", handleScroll);
}, [chatMessages]);

const scrollToBottom = () => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    setShowScrollToBottom(false); // Hide icon after scroll
  }
};

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

const getSenderInfo = (msg: ChatMessage) => {
  // 1. Team Leader's own messages (right side)
  if (!msg.isLeft || msg.fromTeamLeader) {
    return { name: "YOU", role: "TEAM LEADER" };
  }

  // 2. Client messages (updates)
  if (msg.fromClient) {
    return { name: projectDetails?.clientName || "Client", role: "CLIENT" };
  }

  // 3. Head messages
  if (msg.fromHead) {
    return { name: projectDetails?.headName || "Head", role: "HEAD" };
  }

  // Fallback (should never reach here in this component)
  return { name: "Unknown", role: "Unknown" };
};

const handleEditMessage = (msg: ChatMessage) => {
  if (msg.type !== "text" || msg.isDeleted) return;
  setEditingMessage(msg);
  setNewMessage(msg.message || "");
  inputRef.current?.focus();
  setMessageMenuIndex(null);
};

const handleDeleteMessage = async (msg: ChatMessage) => {
  setMessageMenuIndex(null);
  const timestamp = new Date().toISOString();
  setChatMessages((prev) =>
    prev.map((m) =>
      m.timestamp === msg.timestamp && m.fromTeamLeader
        ? { ...m, isDeleted: true, deletedAt: timestamp, message: undefined, file: undefined }
        : m
    )
  );
  if (socket && connected && projectDetails?.project_id && msg.id !== undefined) {
    socket.emit("deleteTLMessage", {
      projectId: projectDetails.project_id,
      index: msg.id,
      timestamp,
    });
  }
};

const sendEditedMessage = async () => {
  if (!editingMessage || !newMessage.trim() || !socket || !connected || !projectDetails?.project_id) return;
  const editedAt = new Date().toISOString();
  setChatMessages((prev) =>
    prev.map((m) =>
      m.timestamp === editingMessage.timestamp && m.fromTeamLeader
        ? { ...m, message: newMessage.trim(), edited: true, editedAt }
        : m
    )
  );
  socket.emit("editTLMessage", {
    projectId: projectDetails.project_id,
    index: editingMessage.id,
    newData: newMessage.trim(),
    editedAt,
  });
  setEditingMessage(null);
  setNewMessage("");
};

const handleSendMessage = async (
  message: string,
  type: "text" | "voice" | "file" = "text",
  files?: { name: string; url: string; type: string; blob?: Blob }[],
  caption?: string   // ← NEW: caption from MikeSearch
) => {
  // If editing an existing message
  if (editingMessage && type === "text") {
    await sendEditedMessage();
    return;
  }

  if (
    (message.trim() || (files && files.length > 0)) &&
    projectDetails?.project_id &&
    socket &&
    connected
  ) {
    setLoading(true);
    try {
      const projId = projectDetails.project_id;
      const timestamp = new Date().toISOString();
      const teamleaderid = parsedData?.employeeId;   // your existing teamleaderid

      // Get current reply context
      const currentReplyTo = replyToMessage
        ? {
            id: replyToMessage.id,
            sender: replyToMessage.sender,
            content: replyToMessage.content,
            type: replyToMessage.type,
            timestamp: replyToMessage.timestamp,
          }
        : null;

      let mention = null;

      if (type === "text" && message.trim()) {
        mention = detectMention(message);
        const tempId = uuidv4();

        const optimisticMsg: ChatMessage = {
          message,
          isLeft: false,
          fromClient: false,
          fromHead: false,
          fromTeamLeader: true,
          type: "text",
          timestamp,
          seen_by: [],
          tempId,
          mention,
          replyTo: currentReplyTo,
        };

        setChatMessages((prev) =>
          [...prev, optimisticMsg].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
          )
        );

        socket.emit("sendTLMessage", {
          projectId: projId,
          type: "text",
          msgData: message,
          timestamp,
          teamleaderid,
          mention,
          tempId,
          replyTo: currentReplyTo,
        });

        setNewMessage("");
        setReplyToMessage(null);
      } 
      else if (type === "voice" && files && files[0]?.blob) {
        const file = files[0];
        const formData = new FormData();
        formData.append("file", file.blob!, file.name);
        formData.append("projectId", projId);

        const uploadResponse = await postData(
          `clientproject/upload_file`,
          formData
        );

        if (uploadResponse.status) {
          const url = uploadResponse.data?.fileUrl || "";
          if (url) {
            const tempId = uuidv4();

            const optimisticMsg: ChatMessage = {
              file: {
                name: file.name,
                url: `${serverURL}${url}`,
                type: file.type || "audio/mp3",
              },
              isLeft: false,
              fromClient: false,
              fromHead: false,
              fromTeamLeader: true,
              type: "file",
              timestamp,
              seen_by: [],
              tempId,
              mention: null,
              replyTo: currentReplyTo,
            };

            setChatMessages((prev) =>
              [...prev, optimisticMsg].sort((a, b) =>
                a.timestamp.localeCompare(b.timestamp)
              )
            );

            socket.emit("sendTLMessage", {
              projectId: projId,
              type: "audio",
              msgData: {
                name: file.name,
                url,
                type: file.type || "audio/mp3",
              },
              timestamp,
              teamleaderid,
              mention: null,
              tempId,
              replyTo: currentReplyTo,
            });

            setReplyToMessage(null);
          }
        }
      } 
      else if (type === "file" && files && files.length > 0) {
        for (const file of files) {
          if (file.blob) {
            const formData = new FormData();
            formData.append("file", file.blob, file.name);
            formData.append("projectId", projId);

            const uploadResponse = await postData(
              `clientproject/upload_file`,
              formData
            );

            if (uploadResponse.status) {
              const url = uploadResponse.data?.fileUrl || "";
              if (url) {
                const tempId = uuidv4();

                const optimisticMsg: ChatMessage = {
                  file: {
                    name: file.name,
                    url: `${serverURL}${url}`,
                    type: file.type,
                  },
                  caption: caption || message.trim() || undefined,   // ← Caption support
                  isLeft: false,
                  fromClient: false,
                  fromHead: false,
                  fromTeamLeader: true,
                  type: "file",
                  timestamp,
                  seen_by: [],
                  tempId,
                  mention: null,
                  replyTo: currentReplyTo,
                };

                setChatMessages((prev) =>
                  [...prev, optimisticMsg].sort((a, b) =>
                    a.timestamp.localeCompare(b.timestamp)
                  )
                );

                socket.emit("sendTLMessage", {
                  projectId: projId,
                  type: "file",
                  msgData: { name: file.name, url, type: file.type },
                  caption: caption || message.trim() || null,   // ← Send caption
                  timestamp,
                  teamleaderid,
                  mention: null,
                  tempId,
                  replyTo: currentReplyTo,
                });
              }
            }
          }
        }
        setReplyToMessage(null);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
      setEditingMessage(null);
    }
  }
};
  const getReadableFileType = (type?: string) => {
    if (!type) return "FILE";
    if (type === "application/pdf") return "PDF";
    if (
      type === "application/msword" ||
      type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
      return "DOC";
    if (type === "application/zip") return "ZIP";
    if (type.startsWith("audio/")) return "AUDIO";
    if (type.startsWith("video/")) return "VIDEO";
    if (type.startsWith("image/")) return "IMAGE";
    return "FILE";
  };
  const handleOpenPreview = (file: File | undefined, msg: ChatMessage) => {
    if (file) {
      setSelectedFile(file);
      setIsModalOpen(true);
      const isReceived = msg.isLeft;
      const viewer = "tl";
      if (isReceived && !msg.seen_by.includes(viewer) && msg.id !== undefined) {
        markMessageAsSeen(msg);
      }
    }
  };
  const handleDownloadFile = async (url: string, name: string) => {
    try {
      if (url.startsWith("blob:")) {
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(url, {
          method: "GET",
          headers: {},
        });
        if (!response.ok) {
          throw new Error("Failed to fetch the file");
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download the file. Please try again.");
    }
  };

  const renderPreview = (file: File) => {
    const { type, url, name } = file;
    if (type.startsWith("image/")) {
      return (
        <img
          src={url}
          alt={name}
          className="max-w-full max-h-[80vh] object-contain"
        />
      );
    } else if (type.startsWith("video/")) {
      return <video controls src={url} className="max-w-full max-h-[80vh]" />;
    } else if (type.startsWith("audio/")) {
      return <audio controls src={url} className="w-full" />;
    } else if (type === "text/html") {
      return (
        <iframe
          src={url}
          title={name}
          className="w-full h-[80vh] border-none"
        />
      );
    } else if (type === "application/pdf") {
      return (
        <iframe
          src={url}
          title={name}
          className="w-full h-[80vh] border-none"
        />
      );
    } else if (
      type === "application/msword" ||
      type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return (
        <iframe
          src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
            url
          )}`}
          title={name}
          className="w-full h-[80vh] border-none"
        />
      );
    } else if (type === "application/zip") {
      return (
        <p className="text-gray-600 italic">
          Preview not available for ZIP files. Please download to view.
        </p>
      );
    } else {
      return (
        <p className="text-gray-600 italic">
          Preview not available for this file type. Please download to view.
        </p>
      );
    }
  };

  const handlePreviewHeightChange = (height: number) => {
    setPreviewHeight(height);
  };
  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };
  useEffect(() => {
    if (isDrawerOpen || isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen, isModalOpen]);
  useEffect(() => {
    if (!projectDetails) return;
    let allMessages: ChatMessage[] = [];
    const maxLengthClient = Math.max(
      projectDetails.clientchats?.length || 0,
      projectDetails.clientaudios?.length || 0
    );
    const maxLengthHead = Math.max(
      projectDetails.headchats?.length || 0,
      projectDetails.headaudios?.length || 0
    );
    const maxLengthTL = Math.max(
      projectDetails.tlchats?.length || 0,
      projectDetails.tlaudios?.length || 0
    );
    const maxLength = Math.max(maxLengthClient, maxLengthHead, maxLengthTL);
    for (let i = 0; i < maxLength; i++) {
      if (i < (projectDetails.clientchats?.length || 0)) {
        const chatStr = projectDetails.clientchats?.[i];
        if (typeof chatStr === "string") {
          try {
            const parsed = JSON.parse(chatStr);
            let timestamp = parsed.timestamp;
            if (!timestamp || isNaN(new Date(timestamp).getTime())) {
              timestamp = new Date().toISOString();
            }
            const msg: ChatMessage = {
              type: parsed.type === "text" ? "text" : "file",
              isLeft: true,
              fromClient: true,
              fromHead: false,
              fromTeamLeader: false,
              timestamp,
              seen_by: parsed.seen_by || [],
              id: i,
              mention: parsed.mention || null,
              replyTo: parsed.replyTo || null,
            };
            if (parsed.type === "text") {
              msg.message = parsed.data;
            } else {
              msg.file = {
                name: parsed.data.name,
                url: `${serverURL}${parsed.data.url}`,
                type: parsed.data.type,
              };
            }
            allMessages.push(msg);
          } catch (e) {
            console.error("Error parsing client chat:", e);
          }
        }
      }
      if (projectDetails.clientaudios && i < projectDetails.clientaudios.length) {
        const audioStr = projectDetails.clientaudios[i];
        try {
          const parsed = JSON.parse(audioStr);
          let timestamp = parsed.timestamp;
          if (!timestamp || isNaN(new Date(timestamp).getTime())) {
            timestamp = new Date().toISOString();
          }
          const msg: ChatMessage = {
            type: "file",
            isLeft: true,
            fromClient: true,
            fromHead: false,
            fromTeamLeader: false,
            file: {
              name: parsed.data.name,
              url: `${serverURL}${parsed.data.url}`,
              type: parsed.data.type,
            },
            timestamp,
            seen_by: parsed.seen_by || [],
            id: i,
            mention: parsed.mention || null,
            replyTo: parsed.replyTo || null,
          };
          allMessages.push(msg);
        } catch (e) {
          console.error("Error parsing client audio:", e);
        }
      }
      if (projectDetails.headchats && i < projectDetails.headchats.length) {
        const chatStr = projectDetails.headchats[i];
        try {
          const parsed = JSON.parse(chatStr);
          let timestamp = parsed.timestamp;
          if (!timestamp || isNaN(new Date(timestamp).getTime())) {
            timestamp = new Date().toISOString();
          }
          const msg: ChatMessage = {
            type: parsed.type === "text" ? "text" : "file",
            isLeft: true,
            fromClient: false,
            fromHead: true,
            fromTeamLeader: false,
            timestamp,
            seen_by: parsed.seen_by || [],
            id: i,
            mention: parsed.mention || null,
            replyTo: parsed.replyTo || null,
          };
          if (parsed.type === "text") {
            msg.message = parsed.data;
          } else {
            msg.file = {
              name: parsed.data.name,
              url: `${serverURL}${parsed.data.url}`,
              type: parsed.data.type,
            };
          }
          allMessages.push(msg);
        } catch (e) {
          console.error("Error parsing head chat:", e);
        }
      }
      if (projectDetails.headaudios && i < projectDetails.headaudios.length) {
        const audioStr = projectDetails.headaudios[i];
        try {
          const parsed = JSON.parse(audioStr);
          let timestamp = parsed.timestamp;
          if (!timestamp || isNaN(new Date(timestamp).getTime())) {
            timestamp = new Date().toISOString();
          }
          const msg: ChatMessage = {
            type: "file",
            isLeft: true,
            fromClient: false,
            fromHead: true,
            fromTeamLeader: false,
            file: {
              name: parsed.data.name,
              url: `${serverURL}${parsed.data.url}`,
              type: parsed.data.type,
            },
            timestamp,
            seen_by: parsed.seen_by || [],
            id: i,
            mention: parsed.mention || null,
            replyTo: parsed.replyTo || null,
          };
          allMessages.push(msg);
        } catch (e) {
          console.error("Error parsing head audio:", e);
        }
      }
      if (projectDetails.tlchats && i < projectDetails.tlchats.length) {
        const chatStr = projectDetails.tlchats[i];
        try {
          const parsed = JSON.parse(chatStr);
          let timestamp = parsed.timestamp;
          if (!timestamp || isNaN(new Date(timestamp).getTime())) {
            timestamp = new Date().toISOString();
          }
          const msg: ChatMessage = {
            type: parsed.type === "text" ? "text" : "file",
            isLeft: false,
            fromClient: false,
            fromHead: false,
            fromTeamLeader: true,
            timestamp,
            seen_by: parsed.seen_by || [],
            id: i,
            mention: parsed.mention || null,
            replyTo: parsed.replyTo || null,
            edited: parsed.edited || false,
            editedAt: parsed.editedAt,
            isDeleted: parsed.isDeleted || false,
            deletedAt: parsed.deletedAt,
            caption: parsed.caption || undefined,
          };
          if (!parsed.isDeleted) {
            if (parsed.type === "text") {
              msg.message = parsed.data;
            } else {
              msg.file = {
                name: parsed.data.name,
                url: `${serverURL}${parsed.data.url}`,
                type: parsed.data.type,
              };
            }
          }
          allMessages.push(msg);
        } catch (e) {
          console.error("Error parsing team leader chat:", e);
        }
      }
      if (projectDetails.tlaudios && i < projectDetails.tlaudios.length) {
        const audioStr = projectDetails.tlaudios[i];
        try {
          const parsed = JSON.parse(audioStr);
          let timestamp = parsed.timestamp;
          if (!timestamp || isNaN(new Date(timestamp).getTime())) {
            timestamp = new Date().toISOString();
          }
          const msg: ChatMessage = {
            type: "file",
            isLeft: false,
            fromClient: false,
            fromHead: false,
            fromTeamLeader: true,
            file: {
              name: parsed.data.name,
              url: `${serverURL}${parsed.data.url}`,
              type: parsed.data.type,
            },
            timestamp,
            seen_by: parsed.seen_by || [],
            id: i,
            mention: parsed.mention || null,
            replyTo: parsed.replyTo || null,
          };
          allMessages.push(msg);
        } catch (e) {
          console.error("Error parsing team leader audio:", e);
        }
      }
    }
    allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setChatMessages(allMessages);
  }, [projectDetails, serverURL]);

  const ActionBar = ({ msg, url, name }: any) => (
    <div
      onClick={(e) => e.stopPropagation()}
      className="
      absolute bottom-0 left-0
      flex gap-3 px-4 py-1
      bg-[#ebfff7a5] shadow-gray-400 shadow-sm backdrop-blur-lg
      border border-white/10
    "
    >
      <div
        onClick={() => handleOpenPreview(msg.file, msg)}
        className="p-2 rounded-full text-blue-400 hover:bg-blue-500/20 transition"
      >
        <FiZoomIn size={12} />
      </div>

      <div
        onClick={() => handleDownloadFile(url, name)}
        className="p-2 rounded-full text-green-400 hover:bg-green-500/20 transition"
      >
        <FiDownload size={12} />
      </div>
    </div>
  );

  return (
<div
      className={`flex flex-col w-full text-black ${
        isLG
          ? "py-20 overflow-y-auto min-h-screen justify-center"
          : isXL || is2XL
          ? "min-h-screen overflow-y-auto py-20 justify-center"
          : "py-26"
      } items-center relative`}
    >
      <MainNavigation isMenuHide={false} />
      <div className=" w-full">
        {/* */}
      <div className={`w-full ${isLG?"px-16":isXL || is2XL?"px-24":"px-4"} items-start flex mb-8 flex-col`}>
        
      <div className="w-full mt-8 flex items-start space-x-7">
        {!isLG && !isXL && !is2XL && (
          <div
            onClick={toggleDrawer}
            className="fixed left-4 top-13 cursor-pointer z-50 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-all hover:scale-105 duration-200"
          >
            <FaBars size={20} />
          </div>
        )}
        {!isLG && !isXL && !is2XL && (
          <div
            className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200/50 shadow-lg z-50 transform transition-transform duration-300 ${
              isDrawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200/50">
              <h2 className="text-lg font-semibold text-gray-800">Progress</h2>
              <div
                onClick={toggleDrawer}
                className="p-1.5 text-gray-800 bg-gray-300 rounded-full hover:text-gray-900"
              >
                <FaTimes size={15} />
              </div>
            </div>
            <div className="p-4 overflow-y-auto h-[calc(100%-4rem)]">
              <div className="flex justify-center">
     <ProgressTracking
      progress={progress}
      onStepClick={dept === 'Technical' ? handleStepClick : undefined}
      updateType={dept === 'Technical' ? 'work' : undefined}
    />
  </div>
            </div>
            <style>
              {`
                .backdrop-blur-md {
                  backdrop-filter: blur(10px);
                  -webkit-backdrop-filter: blur(10px);
                }
              `}
            </style>
          </div>
        )}
        {isDrawerOpen && !isLG && !isXL && !is2XL && (
          <div
            className="fixed inset-0 bg-white/30 backdrop-blur-xs w-full z-40"
            onClick={toggleDrawer}
          ></div>
        )}

        <div
          className="w-full flex flex-col space-y-7"
        >


          <div className="flex ">
                  {isLG || isXL || is2XL ? (
          <div className="mr-7">
            <ProgressTracking
      progress={progress}
      onStepClick={dept === 'Technical' ? handleStepClick : undefined}
      updateType={dept === 'Technical' ? 'work' : undefined}
    />
          </div>
        ) : null}
      
          <div
            className={`w-full grid ${
              isLG || isXL || is2XL
                ? "grid-cols-2 gap-16"
                : "grid-cols-1 gap-4"
            }`}
          >
            
            <div className="w-full flex flex-col items-start space-y-7">
                <div className="items-start flex flex-col">
          <div className="mb-4 ">
          <Button1
            value={item.workstream}
            gradientType="gradient1"
          />
        </div>
        <div className="">
        <div className="leading-relaxed flex items-start flex-col">
          <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
            {item.clientName}
          </div>
          <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
            Project ID: <span className="font-semibold">{projectDetails?.project_id}</span>
          </div>
          <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
            Submission Date: <span className="">
              {new Date(projectDetails?.deadline ?? "").toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })}
            </span>
          </div>
          {projectDetails?.assignedEmployees && (
            <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
              Assigned Employees: <span className="font-semibold">{projectDetails.assignedEmployees}</span>
            </div>
          )}
        </div>
      </div>
        </div>
        
            <div ref={descriptionRef} className="w-full text-start rounded-xl border border-gray-200 flex flex-col items-start  bg-white p-6 shadow-sm">
              <div className="text-[15px] text-[#0587F5] mb-2 flex items-center gap-x-1.5 font-semibold">
                <span>
                  <TbListDetails />
                </span>
                Project Details
              </div>
              <div className="flex items-start flex-col border-b border-black w-full pb-4 mb-4">
                <span className="inline-block bg-red-200 rounded-full px-3 py-1 text-xs font-semibold text-blue-800">
                  {projectDetails?.workstream}
                </span>
                <h3 className="mt-2 text-[12px] font-bold text-gray-900">
                  {projectDetails?.title}
                </h3>
              </div>
              <div
                className={`w-full ${
                  is2XL ? "text-[14px]" : "text-[12px]"
                } flex flex-col space-y-4 items-start`}
              >
<div className="w-full">
  {(() => {
    let initialDesc = "";
    if (projectDetails?.description) {
      if (Array.isArray(projectDetails.description)) {
        initialDesc = projectDetails.description[0] || "";
      } else {
        initialDesc = projectDetails.description || "";
      }
    }
    return (
      initialDesc && (
        <div className="max-h-80 overflow-hidden">
  
  {/* Sticky Header */}
  <div className="sticky top-0 z-10 bg-white">
    <div className="w-fit bg-[#5663E3] skew-x-[-15deg] border-l-4 mb-1 border-cyan-300">
      <div className="text-md font-semibold text-white px-4 py-1 skew-x-[15deg]">
        Description
      </div>
    </div>
  </div>

  {/* Scrollable Content */}
  <div
    className="overflow-y-auto max-h-[calc(20rem-40px)] pr-2
               prose max-w-none 
               [&_img]:max-w-full 
               [&_img]:h-auto 
               [&_img]:max-h-60 
               [&_img]:object-contain 
               [&_img]:rounded-lg 
               [&_img]:mx-0 
               [&_img]:block"
    dangerouslySetInnerHTML={{
      __html: DOMPurify.sanitize(initialDesc),
    }}
  />
</div>
      )
    );
  })()}
  {(() => {
    return (
<div className="max-h-[200px] mb-4 overflow-y-auto thin-scroll">
  <div className="text-md font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full ring-1 ring-inset ring-green-300 w-fit">
    #Updates
  </div>
  <div className="pt-1">
    {isUpdatesLoading ? (
      <div className="flex justify-center items-center h-[100px]">
        <Commet color="#32cd32" size="small" text="Loading updates..." textColor="#000" />
      </div>
    ) : updatesList.length > 0 ? (
      updatesList.map((update, idx) => (
        <div
          key={idx}
          className="cursor-pointer hover:bg-green-50 px-2 py-1.5 rounded-md transition-colors"
          onClick={() => highlightUpdate(update)}
        >
          <span className="font-medium text-green-700">
            {update.number}.
          </span>{" "}
          <span className="text-blue-600 hover:underline font-medium">
            {update.title}
          </span>
        </div>
      ))
    ) : (
      <div className="text-gray-500 italic">
        No update available...!
      </div>
    )}
  </div>
</div>
    );
  })()}
  <div className="flex flex-col w-full space-y-3 sm:flex-row sm:justify-between sm:space-y-0">
    <div className="flex items-center gap-x-1 text-gray-500">
      <RiTimeLine size={15} color="#FF0A78" />
      <span className="font-semibold text-gray-800">
        {new Date(projectDetails?.deadline || "").toLocaleDateString("en-CA")}
      </span>
    </div>
  </div>
</div>
              </div>
            </div>
            
            </div>
            
            {/* chatbox */}
            <div className="space-y-2">
                        <div className="flex justify-end ">
 <div className="flex items-center w-fit gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full transition-all duration-200 cursor-default">
  {/* Live Indicator Dot */}
  <span className="flex w-2 h-2 bg-emerald-500 rounded-full"></span>
  
  <p className="text-sm text-gray-600">
    Talking with <span className="font-semibold text-gray-900">Client</span> & <span className="font-semibold text-gray-900">Head</span>
  </p>
</div>
</div>
           <div
  className={`w-full md:min-h-[400px] min-h-[300px] md:max-h-[650px] max-h-[550px] flex flex-col items-center justify-between pb-4 
  ${isCompleted ? 'bg-[#dddddd]' : 'bg-gradient-to-t from-[#f0f9fd] to-[#CFE3FF]'} 
  ring-1 ring-inset ring-cyan-100/50
  text-slate-500 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)] shadow-[#8A8A8A] rounded-[10px]`}
>
  <div className="w-full relative items-center md:h-[600px] h-[500px] md:max-h-[600px] max-h-[500px] justify-start flex flex-col">
    
    <div
      className="flex items-center w-fit rounded-md justify-center text-white"
      style={{
    background: isCompleted
      ? "conic-gradient(from 0deg at 49.56% 50%, #474747 0deg, #9A9A9A 360deg)"
      : currentTab === "chat"
      ? "conic-gradient(from 0deg at 49.56% 50%, #0348A6 0deg, #011B40 360deg)"
      : "conic-gradient(from 0deg at 49.56% 50%, #011B40 0deg, #0348A6 360deg)",
  }}
    >
      
      <div
        className={`flex ${
          is2XL ? "text-sm" : "text-xs"
        } font-semibold`}
      >
        <div
          className="w-full px-9 py-3 cursor-pointer text-center relative"
          onClick={() => setCurrentTab("chat")}
        >
          Chat
        </div>
        <div
          className="w-full px-9 py-3 cursor-pointer text-center relative"
          onClick={() => setCurrentTab("files")}
        >
          Files
        </div>
      </div>
      
    </div>
    <div className="w-full flex justify-end">
    <div
      onClick={() => {
        setIsFileSelectionMode((v) => !v);
        if (!isFileSelectionMode) setSelectedFileTimestamps(new Set());
      }}
      className="w-fit px-3 py-1 text-[12px] cursor-pointer bg-blue-600/90 text-white rounded-full mr-4 hover:bg-blue-700"
    >
      {isFileSelectionMode ? "Cancel" : <div className="flex items-center gap-x-2">Select Files <BiSolidSelectMultiple size={18}/></div>} 
    </div>
  </div>
    <div
      ref={chatContainerRef}
      className={`w-full px-4 rounded-md ${
        is2XL ? "text-sm" : "text-xs"
      } overflow-y-auto thin-scroll space-y-3`}
      style={{
        paddingTop: "16px",
        paddingBottom: previewHeight > 0 ? previewHeight + 20 : 30,
      }}
    >
      {(() => {
        let currentDate = "";
        let displayedMessages = chatMessages;
        if (currentTab === "files") {
          displayedMessages = chatMessages.filter((msg) => msg.type === "file");
        }
        return displayedMessages.map((msg, index) => {
          const msgDate = new Date(msg.timestamp).toDateString();
          let dateHeader = null;
          if (msgDate !== currentDate) {
            currentDate = msgDate;
            dateHeader = (
              <div className="relative flex items-center justify-center my-8">
                {/* The ultra-thin tech line */}
                <div
                  className="absolute inset-0 flex items-center px-10"
                  aria-hidden="true"
                >
                  <div className="w-full h-[0.5px] bg-blue-400/30"></div>
                </div>

                {/* The Text with a subtle text-shadow for "glow" */}
               <span className="relative border-1 bg-white border-[#010b17] text-center px-4 text-[#064db1] text-[11px] font-medium tracking-[0.25em] uppercase italic drop-shadow-[0_0_3px_rgba(255,255,255,0.8)]">
                              {formatDate(msg.timestamp)}
                            </span>
              </div>
            );
          }
          const sender = getSenderInfo(msg);
          return (
            <React.Fragment key={index}>
              {dateHeader}
              <div
                ref={(el) => {
                  messageRefs.current[`${index}`] = el;
                }}
                // highlight
                className={`group relative flex ${
                  msg.isLeft ? "justify-start" : "justify-end"
                } my-5`}
              >
                <div
                  className={`flex max-w-[85%] md:max-w-[60%] items-center ${
                    msg.isLeft ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div
                    className={`w-8 h-8 ${
                      msg.isLeft ? "mr-2" : "ml-2"
                    } shrink-0 rounded-full flex items-center justify-center`}
                  >
                    {!storedUserData ? (
                      <img
                        src={UserIcon}
                        alt="User Icon"
                        className="w-full h-full"
                      />
                    ) : (
                      <img
                        src={`${serverURL}/files/${
                          msg.fromClient
                            ? projectDetails?.clientPic
                            : msg.fromHead
                            ? projectDetails?.headPic
                            : parsedData?.employeePic
                        }`}
                        alt="Profile"
                        className="w-full h-full rounded-full border-2 border-blue-500/50"
                        onError={(e) => {
                          e.currentTarget.src = UserIcon;
                        }}
                      />
                    )}
                  </div>

                  <div className="relative p-1 text-start">
                    <div className="flex items-center mb-1 group">
                      {/* The Technical Accent Bar */}
                      <div className="h-4 w-[2px] bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>

                      <div className="flex items-center gap-1 bg-[#f6fff2] backdrop-blur-sm px-2 py-0.5 rounded-r-sm border-l border-white/50">
                        {/* Sender Name */}
                        <span className="text-[9px] font-black text-blue-950 tracking-wide uppercase font-sans">
                          {sender.name}
                        </span>

                        {/* Small Technical Separator */}
                        <span className="text-[8px] text-blue-300 font-mono select-none">
                          |
                        </span>

                        {/* Sender Role - High Contrast Red */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono font-bold text-[#FF2912] uppercase tracking-[0.15em]">
                            {sender.role}
                          </span>

                          {/* Decorative pulse point */}
                          <span className="relative flex h-1 w-1">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF2912] opacity-40"></span>
                            <span className="relative inline-flex rounded-full h-1 w-1 bg-[#FF2912]"></span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      // chats-width

                      className={`backdrop-blur-xl sm:w-fit sm:max-w-[250px] md:w-fit md:max-w-[180px] lg:w-fit lg:max-w-[220px] w-fit max-w-[180px] ${
                        msg.isLeft
                          ? "bg-white "
                          : "bg-[#fffddc] border-r-yellow-600/30 border-r-[3px]"
                      } shadow-[0_4px_20px_-4px_rgba(100,116,139,0.12)] p-3 rounded-2xl ${
                        msg.isLeft
                          ? "rounded-tl-none border-l-blue-600/30 border-l-[3px]"
                          : "rounded-br-none"
                      }  transition-all duration-200 ease-out
`}
                    >
                      {msg.replyTo && (
                        <div
                          onClick={() =>
                            handleClickOnReplyBubble(msg.replyTo!)
                          }
                          className="mb-2 p-2 bg-[#ececec] rounded-md border-l-4 border-blue-500 cursor-pointer hover:bg-gray-200 transition"
                        >
                          <div className="text-xs font-medium text-gray-600">
                            {msg.replyTo.sender === "Team Leader"
                              ? "You"
                              : msg.replyTo.sender}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {msg.replyTo.content}
                          </div>
                        </div>
                      )}
                      {msg.isDeleted ? (
                        <div className="text-gray-400 italic text-xs flex items-center gap-1 py-1">
                          <MdBlock size={14} />
                          {!msg.isLeft ? "You deleted this message" : "This message was deleted"}
                        </div>
                      ) : (
                        <>
                          {msg.type === "text" && msg.message && (
                            <div
                              className="text-gray-900 leading-snug break-words hyphens-auto"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(
                                  highlightMessageText(
                                    msg.message || "",
                                    msg.mention
                                  )
                                ),
                              }}
                            />
                          )}
                        </>
                      )}
                      {/* here-- */}
                      {msg.file &&
                        msg.file.url &&
                        msg.file.name &&
                        !msg.isDeleted && (
                          <div className="relative">
                            {isFileSelectionMode && (
                              <input
                                type="checkbox"
                                checked={selectedFileTimestamps.has(msg.timestamp)}
                                onChange={() => toggleFileSelect(msg.timestamp)}
                                className={`absolute top-[13.3px] left-[16.5px] z-20 w-7 h-7 rounded-[10px] border-2 border-blue-500 bg-white/90 checked:bg-blue-600`}
                              />
                            )}
                            <div
                              ref={index === msgControl ? divRef : null}
                              onClick={() =>
                                setMsgControl(
                                  msgControl === index ? null : index
                                )
                              }
                              className="
                                group relative mt-1 h-fit shadow-sm shadow-amber-200 max-w-[300px] cursor-pointer overflow-hidden
                                rounded-xl border border-slate-200 bg-white
                                transition-all duration-300 ease-out
                                hover:border-slate-400 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]
                                active:scale-[0.985]
                              "
                            >
                              {/* HEADER */}
                              <div className="flex items-center gap-3 px-3 py-2">
                                {(() => {
                                  const fileType = msg.file.type;
                                  let Icon = FaFileInvoice;
                                  let color = "text-slate-600";

                                  if (fileType.startsWith("audio/")) {
                                    Icon = FaFileAudio;
                                    color = "text-orange-500";
                                  } else if (fileType.startsWith("image/")) {
                                    Icon = FaFileImage;
                                    color = "text-emerald-500";
                                  } else if (fileType.startsWith("video/")) {
                                    Icon = FaFileVideo;
                                    color = "text-violet-500";
                                  } else if (fileType === "application/pdf") {
                                    Icon = FaFilePdf;
                                    color = "text-rose-500";
                                  } else if (
                                    fileType === "application/msword" ||
                                    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                  ) {
                                    Icon = FaFileWord;
                                    color = "text-sky-600";
                                  } else if (fileType === "application/zip") {
                                    Icon = FaFileArchive;
                                    color = "text-amber-500";
                                  } else if (fileType === "text/html") {
                                    Icon = FaRegFileAlt;
                                    color = "text-amber-500";
                                  }

                                  return (
                                    <div
                                      className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 ${color}`}
                                    >
                                      <Icon size={18} />
                                    </div>
                                  );
                                })()}

                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-[13px] font-medium text-slate-800">
                                    {msg.file.name}
                                  </p>
                                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                    {getReadableFileType(msg.file.type)}
                                  </p>
                                </div>
                              </div>

                              {/* PREVIEW */}
                              {(() => {
                                const fileType = msg.file.type;
                                const url = msg.file.url.startsWith("blob:")
                                  ? msg.file.url
                                  : `${msg.file.url}`;
                                const name = msg.file.name;

                                if (fileType.startsWith("audio/")) {
                                  return (
                                    <div className="px-3 pb-2">
                                      <audio
                                        controls
                                        src={url}
                                        className="block h-7 w-full opacity-80 hover:opacity-100 m-0 p-0"
                                      />
                                    </div>
                                  );
                                } else if (fileType.startsWith("image/")) {
                                  return (
                                    <div className="relative mx-3 mb-2 overflow-hidden rounded-lg border border-slate-100">
                                      <img
                                        src={url}
                                        alt={name}
                                        className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      />
                                      {msgControl === index && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                                          <ActionBar msg={msg} index={index} url={url} name={name} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else if (fileType.startsWith("video/")) {
                                  return (
                                    <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-slate-100">
                                      <video
                                        controls
                                        src={url}
                                        className="block aspect-video w-full object-cover bg-black m-0"
                                      />
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="px-3 pb-2">
                                      {msgControl === index && (
                                        <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                                          <ActionBar msg={msg} index={index} url={url} name={name} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              })()}

                              {/* 🔥 NEW: Caption display (text attached with file) */}
                              {msg.caption && (
                                <div className="px-3 pb-3 text-gray-800 text-[13px] break-words leading-snug border-t border-slate-100 pt-2">
                                  {msg.caption}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {msg.caption && !msg.isDeleted && (
                        <div className="text-gray-800 text-[13px] mt-1.5 px-1 break-words leading-snug">
                          {msg.caption}
                        </div>
                      )}
                      {!msg.isLeft && !msg.isDeleted && (
                        <div className="relative flex justify-end mt-1">
                          <div
                            className="cursor-pointer p-0.5 rounded-full hover:bg-gray-200 text-gray-400"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setMessageMenuIndex(messageMenuIndex === index ? null : index); }}
                          >
                            <BsThreeDotsVertical size={13} />
                          </div>
                          {messageMenuIndex === index && (
                            <div
                              className="absolute bottom-6 right-0 bg-white shadow-xl rounded-xl border border-gray-100 z-50 min-w-[110px] overflow-hidden"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {msg.type === "text" && (
                                <div
                                  onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                                >
                                  <MdEdit size={15} className="text-blue-500" /> Edit
                                </div>
                              )}
                              <div
                                onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 cursor-pointer"
                              >
                                <MdDelete size={15} /> Delete
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={`text-xs text-gray-500 mt-1 text-right`}
                      >
                        {msg.edited && (
                          <span className="text-[10px] text-amber-500 mr-1 italic">edited</span>
                        )}
                        {new Date(msg.timestamp).toLocaleTimeString(
                          "en-IN",
                          {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          }
                        )}
                        {!msg.isLeft && msg.fromTeamLeader && (
                          <span className="inline-flex items-center">
                            <IoCheckmarkDoneSharp
                              size={14}
                              color={
                                isAllSeen(msg)
                                  ? "#00B7FF"
                                  : "#000000"
                              }
                              className="inline-block ml-1"
                            />
                            <FaInfoCircle
                              size={12}
                              color="#808080"
                              title={getSeenText(msg)}
                              className="inline-block ml-1 cursor-help"
                            />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {msg.isLeft && !isCompleted && (
                    <div
                      onClick={() => handleReplyToMessage(msg)}
                      className="transition-all duration-200 cursor-pointer p-0.5 rounded-full
               bg-slate-50 border border-slate-300
               flex items-center justify-center
               shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
               hover:bg-slate-800 hover:text-white hover:border-slate-800
               hover:shadow-[3px_3px_0px_0px_rgba(59,130,246,0.3)]
               active:translate-x-[1px] active:translate-y-[1px]
               active:shadow-none text-slate-500"
                    >
                      <MdOutlineReply size={15} />
                    </div>
                  )}
                  {!msg.isLeft && !isCompleted && (
                    <div
                      onClick={() => handleReplyToMessage(msg)}
                      className="transition-all duration-200 cursor-pointer p-0.5 rounded-full
               bg-slate-50 border border-slate-300
               flex items-center justify-center
               shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]
               hover:bg-slate-800 hover:text-white hover:border-slate-800
               hover:shadow-[3px_3px_0px_0px_rgba(59,130,246,0.3)]
               active:translate-x-[1px] active:translate-y-[1px]
               active:shadow-none text-slate-500"
                    >
                      <MdOutlineReply
                        className="scale-x-[-1]"
                        size={15}
                      />
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        });
      })()}
      {loading && (
        <div className="flex justify-end my-2">
          <div className="flex items-center flex-row-reverse">
            <div className="w-8 h-8 ml-2 shrink-0 rounded-full flex items-center justify-center">
              {!storedUserData ? (
                <img
                  src={UserIcon}
                  alt="User Icon"
                  className="w-full h-full"
                />
              ) : (
                <img
                  src={`${serverURL}/files/${parsedData?.employeePic}`}
                  alt="Profile"
                  className="w-10 h-8 rounded-full border-2 border-blue-500/50"
                  onError={(e) => {
                    e.currentTarget.src = UserIcon;
                  }}
                />
              )}
            </div>
            <div
              className={`${
                isSM || isXS || isXXS
                  ? "pr-0 max-w-[220px] min-w-[80%]"
                  : "pr-12 max-w-[300px] min-w-[50%]"
              } text-start py-2 rounded-lg bg-white p-3 pr-4 shadow-sm relative break-words flex justify-center items-center`}
            >
              <div className="flex space-x-1">
                <span
                  className="h-2 w-2 bg-blue-500 rounded-full"
                  style={{
                    animation:
                      "bounceDot 0.6s infinite ease-in-out",
                    animationDelay: "0s",
                  }}
                ></span>
                <span
                  className="h-2 w-2 bg-blue-500 rounded-full"
                  style={{
                    animation:
                      "bounceDot 0.6s infinite ease-in-out",
                    animationDelay: "0.2s",
                  }}
                ></span>
                <span
                  className="h-2 w-2 bg-blue-500 rounded-full"
                  style={{
                    animation:
                      "bounceDot 0.6s infinite ease-in-out",
                    animationDelay: "0.4s",
                  }}
                ></span>
              </div>
              <style>{`@keyframes bounceDot { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`}</style>
            </div>
          </div>
        </div>
      )}
      {showScrollToBottom && (
        <div
          onClick={scrollToBottom}
          className="bottom-4 cursor-pointer absolute right-4 w-fit z-10 p-1.5 bg-[#9C9C9C] text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-110"
        >
          <MdOutlineDoubleArrow className="rotate-90" size={12} />
        </div>
      )}
      {isFileSelectionMode && selectedFileTimestamps.size > 0 && (
  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
    <div className="flex items-center gap-6 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 text-white px-5 py-2.5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
      
      {/* Selection Count with a subtle pulse */}
      <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold">
          {selectedFileTimestamps.size}
        </span>
        <span className="text-sm font-semibold tracking-tight">Selected</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Primary Action: High Contrast */}
        <div
          onClick={() => forwardFiles(Array.from(selectedFileTimestamps))}
          className="bg-blue-600 cursor-pointer hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          Forward to Employee Chat
        </div>

        {/* Secondary Action: Subtle but accessible */}
        <button
          onClick={() => {
            setSelectedFileTimestamps(new Set());
            setIsFileSelectionMode(false);
          }}
          className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  </div>
<div className="w-[90%]">
  <MikeSearch
    value={newMessage}
    onChange={handleInputChange}
    onKeyDown={handleKeyDown}
    onSend={handleSendMessage}
    disabled={isCompleted}
    placeholder="Type your message..."
    onPreviewHeightChange={handlePreviewHeightChange}
    inputRef={inputRef}
    mentionOptions={mentionOptions}
    onMentionSelect={handleMentionSelect}
    replyTo={replyToMessage}
    onCancelReply={() => { setReplyToMessage(null); setEditingMessage(null); setNewMessage(""); }}
    editingMessage={editingMessage ? { content: editingMessage.message || "" } : null}
    onCancelEdit={() => { setEditingMessage(null); setNewMessage(""); }}
    projectId={projectDetails?.project_id}
  />
</div>
</div>
</div>
          </div>
          </div>
          {dept==="Technical" && (<div className="w-[100%] mt-[7vh] border-1 border-[#000]"></div>)}
          {dept==="Technical" && (
    <div className={`w-full  pb-[5vh] pt-[2vh] flex flex-col items-start`}>
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
    } pt-[2vh] font-medium -tracking-[0.02rem]`}
  >
    Requests
  </div>
  {isLoadingRequests ? (
    <div className={`pt-[2vh] text-gray-500`}>
      <Commet color="#32cd32" size="medium" text="Loading requests..." textColor="#000" />
    </div>
  ) : errorRequests ? (
    <div className={`pt-[2vh] text-red-600`}>{errorRequests}</div>
  ) : (
    <div
      className={`${
        isXXS || isXS || isSM || isMD || isLG ? "flex flex-col" : "flex flex-row space-x-4"
      } w-full pt-[2vh]`}
    >
      {/* Employee Request List Section */}
      <div
        className={`${isXXS || isXS || isSM || isMD || isLG ? "w-full" : "w-[70%]"} space-y-5 pt-2`}
      >
        {employees.length === 0 ? (
          <div className={`text-gray-500 text-start`}>No Employee Assigned for the Project</div>
        ) : (
          <>
            <div className="block md:hidden pb-2 overflow-x-auto">
              <div className="flex gap-5 w-max items-end">
                {employees.map((leader, index) => (
                  <div key={index} className="min-w-[250px] flex-shrink-0 relative">
                    <ProfileWithDesignation
  IsSmall={leader.isSmall}
  Status={leader.status}
  EmployeeName={leader.EmployeeName}
  profile={leader.EmployeeProfile}
  // showMonitorOption={true} // Added prop
  employeeId={leader.employeeId}
  projectId={item.project_id}
  onMakeMonitor={handleMakeMonitor} // Added prop
  onRemoveMonitor={handleRemoveMonitor} // NEW: Added prop for remove
/>
                  </div>
                ))}
              </div>
             
            </div>
            <div
              className={`hidden md:grid items-end custom-indent-wrap gap-x-5 gap-y-5 ${
                isMD || isLG ? "grid-cols-3" : isXL || is2XL ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {employees.map((leader, index) => (
                <>
                <div key={index} className="bg-white">
                  <ProfileWithDesignation
  IsSmall={leader.isSmall}
  Status={leader.status}
  EmployeeName={leader.EmployeeName}
  profile={leader.EmployeeProfile}
  // showMonitorOption={true} // Added prop
  employeeId={leader.employeeId}
  projectId={item.project_id}
  onMakeMonitor={handleMakeMonitor} // Added prop
  onRemoveMonitor={handleRemoveMonitor} // NEW: Added prop for remove
/>
                </div>
                </>
              ))}
            </div>
          </>
        )}
      </div>
      {/* Self Assign Section */}
      <div
        className={`flex flex-col space-y-6 ${is2XL || isXL ? "pl-6 w-[35%]" : "mt-4"} items-start`}
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
            <option key={des} value={des}>{des}</option>
          ))}
        </select>
        <div className="w-full">
          {filteredAllEmployees.length > 0 ? (
            <div className="w-full text-black bg-white border border-slate-200 rounded-lg max-h-[220px] overflow-y-auto thin-scroll shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 transition-all">
              <ul className="divide-y divide-slate-200">
                {filteredAllEmployees.map((emp) => {
                  const isSelected = selectedEmployeeIds.includes(emp.employeeId);
                  const initials = emp.employeeName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("");
                  return (
                    <li
                      key={emp.employeeId}
                      onClick={() => handleCheckboxChange(emp.employeeId)}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors duration-150 relative ${
                        isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-l-md"></div>
                      )}
                      <div className="flex items-center space-x-4">
                        {!emp.employeePic ? (
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-slate-200 rounded-full font-bold text-slate-500">
                            {initials}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <img
                              src={`${serverURL}/files/${emp.employeePic}`}
                              alt={emp.employeeName}
                              className="h-10 w-10 rounded-full object-cover border border-gray-200 shadow-sm"
                            />
                          </div>
                        )}
                        <div className="text-start">
                          <p className="font-semibold text-slate-800">{emp.employeeName}</p>
                          <p className="text-sm text-slate-500">{emp.employeeDesignation}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-slate-500 font-mono hidden sm:block">
                          ID: {emp.employmentID}
                        </span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          readOnly
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
        <Button2
  value={isAssigning ? "Assigning Employees..." : "Assign to Selected"}
  onClick={handleAssignSelected}
  disabled={isCompleted || selectedEmployeeIds.length === 0 || isAssigning}
/>
      </div>
    </div>
  )}
</div>)}
     
      </div>
        {isModalOpen && selectedFile && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex z-50 transition-all duration-300"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="bg-gray-50 mx-2 md:mx-10 shadow-2xl overflow-hidden relative flex flex-col transition-all duration-500 ease-out"
              style={{
                marginTop: "20px",
                width: "calc(100% - 20px)",
                height: "calc(100% - 20px)",
                borderTopLeftRadius: "24px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 md:px-8 py-6 md:py-10 bg-white border-b border-gray-100 shadow-sm z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[2px] text-green-600 font-bold mb-0.5">
                    Document Preview
                  </span>
                  <h2 className="text-lg font-medium text-slate-800 truncate max-w-md">
                    {selectedFile.name}
                  </h2>
                </div>

                <div className="flex items-center space-x-4">
                  <div
                    onClick={() =>
                      handleDownloadFile(selectedFile.url, selectedFile.name)
                    }
                    className="flex cursor-pointer items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-full text-sm font-medium hover:bg-green-600 transition-all shadow-lg hover:shadow-green-200 active:scale-95"
                  >
                    <FiDownload size={16} />
                    <span>Export</span>
                  </div>

                  <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden md:block" />

                  <div
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 cursor-pointer bg-gray-200 text-black hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    aria-label="Close"
                  >
                    <FiX size={22} />
                  </div>
                </div>
              </div>

              {/* Preview Area */}
              <div className="flex-1 bg-slate-200/50 p-4 md:p-8 overflow-y-auto flex justify-center">
                <div className="w-full max-w-5xl h-full shadow-2xl bg-white rounded-sm overflow-hidden border border-gray-300">
                  {renderPreview(selectedFile)}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
    </div>
    </div>
    </div>
  );
};
export default TeamLeaderProjectInfo;