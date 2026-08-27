import React, { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import Button1 from "../../UI_Components/Buttons/Button1";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import MikeSearch from "../../UI_Components/SearchBars/MikeSearch";
import UserIcon from "../../assets/CredientialAssets/UserLogo.png";
import {
  FaFileAudio,
  FaFileImage,
  FaFileInvoice,
  FaFileVideo,
  FaRegFileAlt,
  FaBars,
  FaTimes,
  FaFilePdf,
  FaFileArchive,
  FaFileWord,
  FaInfoCircle,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { FiDownload, FiX, FiZoomIn } from "react-icons/fi";
import { RiTimeLine } from "react-icons/ri";
import { TbListDetails } from "react-icons/tb";
import { BiSolidSelectMultiple } from "react-icons/bi";
import {
  serverURL,
  postData,
  getData,
} from "../../BackendConnections/FetchBackendServices";
import { IoCheckmarkDoneSharp } from "react-icons/io5";
import { matchesChatMessage, playChatNotificationSound, safeSocketEmit, seenByEmployee, unlockChatNotificationSound } from "../../utils/chatLive";
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from "../../BackendConnections/useSocket";
import { Commet } from "react-loading-indicators";
import { MdDelete, MdEdit, MdOutlineDoubleArrow, MdOutlineReply, MdBlock, MdSwapHoriz } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";
import ProgressTracking from "../../UI_Components/Progresses/ProgressTracking";
import FileUploadBubble from "../../FileSendUI/FileUploadBubble";
import { useProjectChatFileUpload } from "../../FileSendUI/useProjectChatFileUpload";
import {
  appendLocalMonitorFileMessage,
  formatMonitorSenderLabel,
  mergeMonitorChatMessage,
  mergeMonitorSnapshot,
  // absoluteMonitorFileUrl,
} from "../../FileSendUI/monitorChatMerge";
import { buildChatFilePayload, downloadChatFile, formatChatTime, isChatAudioFile, normalizeMimeType } from "../../FileSendUI/chatFileUtils";

interface ChatMessage {
  type: "text" | "file";
  isLeft: boolean;
  fromTL: boolean;
  fromClient?: boolean;
  message?: string;
  file?: { url: string; name: string; type: string; blob?: Blob };
  timestamp: string;
  seen_by: string[];
  id?: any;
  tempId?: string; // For optimistic updates
  messageId?: string;
  caption?: string;
  replyTo?: ReplyMessage | null;
  senderName?: string;
  senderPic?: string;
  senderId?: string;
  edited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

interface ReplyMessage {
  id: number;
  sender: string; // e.g., "Team Leader", "Monitor"
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
  assignedEmployees?: string;
  clientid?: string;
  headid?: string;
  clientchats?: string[];
  clientaudios?: string[];
  status?: string;
}

interface File {
  url: string;
  name: string;
  type: string;
}

interface UpdateItem {
  number: number;
  title: string;
  messageTimestamp: string;
  isText: boolean;
}

const TeamLeaderProjectInfoWithEmployee: React.FC = () => {
  const [replyToMessage, setReplyToMessage] = useState<ReplyMessage | null>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
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
  const playNotification = useCallback(() => {
    playChatNotificationSound();
  }, []);
  useEffect(() => {
    unlockChatNotificationSound();
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { item } = location.state || {};
  const storedUserData = localStorage.getItem("userData");
  const parsedData = storedUserData ? JSON.parse(atob(storedUserData)) : null;
  const storedUserRole = localStorage.getItem("role")
    ? atob(localStorage.getItem("role")!)
    : "";
  const [width, setWidth] = useState(window.innerWidth);
  
  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const observer = useRef<IntersectionObserver | null>(null);
  const [tlMonitorChats, setTlMonitorChats] = useState<any>(null); // To store fetched TL-Monitor chats
  const { socket, connected, onEvent } = useSocket();
  const [updatesList, setUpdatesList] = useState<UpdateItem[]>([]);
  const [isUpdatesLoading, setIsUpdatesLoading] = useState(true);
const [isFileSelectionMode, setIsFileSelectionMode] = useState(false);
const [selectedFileTimestamps, setSelectedFileTimestamps] = useState<Set<string>>(new Set());
const [progress, setProgress] = useState({ start: 'no', payment: '0%', work: '0%' });

const designation = parsedData?.employeeDesignation || '';
const deptMatch = designation.match(/\(([^)]+)\)$/);
const dept = deptMatch ? deptMatch[1].trim() : null;

  const myEmployeeId = parsedData?.employeeId || "";
  const myEmployeeName = parsedData?.employeeName || "";
  const myEmployeePic = parsedData?.employeePic || "";

  const {
    uploadTasks,
    addChatFiles,
    pause: pauseUpload,
    resume: resumeUpload,
    cancel: cancelUpload,
    retry: retryUpload,
  } = useProjectChatFileUpload({
    projectId: projectDetails?.project_id || item?.project_id || "",
    role: "tl_monitor",
    uploaderId: myEmployeeId,
    uploaderName: myEmployeeName,
    uploaderPic: myEmployeePic,
    socket,
    connected,
    getSocketExtra: () => ({
      senderId: myEmployeeId,
      senderName: myEmployeeName,
      senderPic: myEmployeePic,
    }),
    onLocalMessage: (msg) => {
      setChatMessages((prev) =>
        appendLocalMonitorFileMessage(prev, {
          ...msg,
          fromTL: true,
          isLeft: false,
          senderId: String(myEmployeeId),
          senderName: myEmployeeName || "You",
          senderPic: myEmployeePic,
        } as any),
      );
    },
  });
const toggleFileSelect = (timestamp: string) => {
  setSelectedFileTimestamps((prev) => {
    const next = new Set(prev);
    next.has(timestamp) ? next.delete(timestamp) : next.add(timestamp);
    return next;
  });
};


const handleEditMessage = (msg: ChatMessage) => {
  if (msg.type !== "text") return;
  if (!isWithinEditWindow(msg)) {
    setShowTimeLimitPopup(true);
    setTimeout(() => setShowTimeLimitPopup(false), 2500);
    setMessageMenuIndex(null);
    return;
  }
  setEditingMessage(msg);
  setNewMessage(msg.message || "");
  inputRef.current?.focus();
  setMessageMenuIndex(null);
};

const sendEditedMessage = () => {
  if (!editingMessage || !projectDetails?.project_id || !socket || !connected) return;

  const editedAt = new Date().toISOString();

  setChatMessages(prev =>
    prev.map(m =>
      m.timestamp === editingMessage.timestamp
        ? { ...m, message: newMessage.trim(), edited: true, editedAt }
        : m
    )
  );

  socket.emit("editTLMonitorMessage", {
    projectId: projectDetails.project_id,
    index: editingMessage.id,
    newData: newMessage.trim(),
    timestamp: editingMessage.timestamp,
    fromTL: true,
  });

  setEditingMessage(null);
  setNewMessage("");
};

const handleDeleteMessage = (msg: ChatMessage) => {
  if (!projectDetails?.project_id || !socket || !connected) return;
  setMessageMenuIndex(null);

  if (!isWithinEditWindow(msg)) {
    setShowTimeLimitPopup(true);
    setTimeout(() => setShowTimeLimitPopup(false), 2500);
    return;
  }

  setChatMessages(prev =>
    prev.map(m =>
      m.timestamp === msg.timestamp
        ? { ...m, isDeleted: true, deletedAt: new Date().toISOString(), message: undefined, file: undefined }
        : m
    )
  );

  socket.emit("deleteTLMonitorMessage", {
    projectId: projectDetails.project_id,
    index: msg.id,
    timestamp: msg.timestamp,
    fromTL: true,
  });
};

const isCompleted = projectDetails?.status === "Completed";
const isChatDisabled = projectDetails?.status === "Completed" || projectDetails?.status === "Hold";
const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
const [messageMenuIndex, setMessageMenuIndex] = useState<number | null>(null);
const [showTimeLimitPopup, setShowTimeLimitPopup] = useState(false);

console.log(showTimeLimitPopup);


const isWithinEditWindow = (msg: ChatMessage): boolean => {
  if (!msg.timestamp) return false;
  return Date.now() - new Date(msg.timestamp).getTime() < 2 * 60 * 1000;
};

const forwardFiles = async (timestamps: string[]) => {
  if (!projectDetails?.project_id || !parsedData?.employeeId || !socket || !connected) return;

  const projId = projectDetails.project_id;
  const teamleaderid = parsedData.employeeId;

  let forwardedCount = 0;

  for (const ts of timestamps) {
    const msg = chatMessages.find((m) => m.timestamp === ts && !m.isDeleted);
    if (!msg) continue;

    const timestamp = new Date().toISOString();
    const tempId = uuidv4();

    try {
      if (msg.type === "file" && msg.file) {
        // ===== FORWARD FILE =====
        const msgData = {
          name: msg.file.name,
          url: getRelativeUrl(msg.file.url),
          type: msg.file.type,
        };

        // 1. Save to database
        await postData(`clientproject/add_tl_chat/${projId}`, {
          type: "file",
          data: msgData,
          timestamp,
          teamleaderid,
        });

        // 2. Emit live to Client + Head
        socket.emit("sendTLMessage", {
          projectId: projId,
          type: "file",
          msgData: msgData,
          timestamp,
          teamleaderid,
          tempId,
        });

      } else if (msg.type === "text" && msg.message) {
        // ===== FORWARD TEXT =====
        // 1. Save to database
        await postData(`clientproject/add_tl_chat/${projId}`, {
          type: "text",
          data: msg.message,
          timestamp,
          teamleaderid,
        });

        // 2. Emit live to Client + Head
        socket.emit("sendTLMessage", {
          projectId: projId,
          type: "text",
          msgData: msg.message,
          timestamp,
          teamleaderid,
          tempId,
        });
      }

      forwardedCount++;
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
  
const getRelativeUrl = (fullUrl: string): string => {
  let rel = fullUrl.replace(serverURL, "").replace(/^\/+/, "/");
  if (!rel.startsWith("/files/")) {
    const filename = fullUrl.split("/").pop() || "";
    rel = `/files/${filename}`;
  }
  return rel;
};
 const handleReplyToMessage = (msg: ChatMessage) => {
  const isCurrentUserTL = storedUserRole === "Team Leader";
  
  const sender = msg.fromTL
    ? (isCurrentUserTL ? "You" : "Team Leader")
    : (isCurrentUserTL ? msg.senderName || "Employee" : "You");
    
  const content = msg.type === "text"
    ? (msg.message?.substring(0, 50) + (msg.message && msg.message.length > 50 ? "..." : ""))
    : msg.file?.name || "File";
    
  setReplyToMessage({
    id: msg.id ?? -1,
    sender,
    content,
    type: msg.type,
    timestamp: msg.timestamp,
  });
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

  const fetchProject = async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const response = await getData(
        `clientproject/get_project/${item.project_id}`
      );
      if (response.status) {
        setProjectDetails(response.data);
      }
    } catch (error) {
      console.error("Error fetching project data:", error);
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  const fetchTlMonitorChats = useCallback(async () => {
    if (!item?.project_id) return;
    try {
      const response = await getData(
        `clientproject/get_tl_monitor_chats/${item.project_id}`
      );
      if (response.status) {
        setTlMonitorChats(response.data);
      }
    } catch (error) {
      console.error("Error fetching TL-Monitor chats:", error);
    }
  }, [item?.project_id]);

useEffect(() => {
  if (!tlMonitorChats) return;

  const allMessages: ChatMessage[] = [];

  const processArray = (arr: any[] | undefined, isFromTL: boolean) => {
    if (!arr) return;

    let list = arr;
    if (typeof arr === "string") {
      try {
        list = JSON.parse(arr);
      } catch {
        return;
      }
    }
    if (!Array.isArray(list)) return;

    list.forEach((str, index) => {
      try {
        const parsed = typeof str === "string" ? JSON.parse(str) : str;

        const msg: ChatMessage = {
          type: parsed.type === "text" ? "text" : "file",
          isLeft: !isFromTL,
          fromTL: isFromTL,
          timestamp: parsed.timestamp,
          seen_by: parsed.seen_by || [],
          id: isFromTL ? `tl-${index}` : `emp-${index}`,
          replyTo: parsed.replyTo || null,
          senderId: parsed.senderId,
          senderName:
            parsed.senderName ||
            (isFromTL ? tlMonitorChats.teamleadername : tlMonitorChats.monitorname) ||
            "Unknown",
          senderPic:
            parsed.senderPic ||
            (isFromTL ? tlMonitorChats.teamleaderpic : tlMonitorChats.monitorpic) ||
            "",
          caption: parsed.caption || undefined,
          edited: !!parsed.edited,          // force boolean
          editedAt: parsed.editedAt || undefined,
          isDeleted: !!parsed.isDeleted,    // force boolean
          deletedAt: parsed.deletedAt || undefined,
        };

        if (parsed.type === "text") {
          msg.message = parsed.isDeleted ? undefined : parsed.data;
        } else if (parsed.data) {
          msg.file = parsed.isDeleted
            ? undefined
            : buildChatFilePayload({
                name: parsed.data.name,
                url: parsed.data.url,
                type: parsed.data.type,
              }).file;
        }

        allMessages.push(msg);
      } catch (err) {
        console.error("parse error", err);
      }
    });
  };

  processArray(tlMonitorChats.tlchats, true);
  processArray(tlMonitorChats.tlaudios, true);
  processArray(tlMonitorChats.monitorchats, false);
  processArray(tlMonitorChats.monitoraudios, false);

  allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  setChatMessages((prev) => mergeMonitorSnapshot(allMessages, prev));
}, [tlMonitorChats]);

  useEffect(() => {
    if (item?.project_id) {
      fetchProject();
      fetchTlMonitorChats();
    } else {
      setProjectDetails(item);
    }
  }, [item]);

  useEffect(() => {
    const projectId = projectDetails?.project_id || item?.project_id;
    if (!socket || !projectId) return;
    safeSocketEmit(socket, "joinEmployeeChat", projectId);
    safeSocketEmit(socket, "joinProject", projectId);
    safeSocketEmit(socket, "requestTLMonitorChats", projectId);
  }, [socket, connected, projectDetails?.project_id, item?.project_id]);



useEffect(() => {
  if (!socket) return;

  const applyMonitorMsg = (data: { fromRole: string; msg: any; projectId?: string | number }) => {
    const activeProjectId = projectDetails?.project_id || item?.project_id;
    if (data.projectId && activeProjectId && String(data.projectId) !== String(activeProjectId)) return;
    setChatMessages((prev) =>
      mergeMonitorChatMessage(prev, data, {
        myId: String(myEmployeeId),
        isTLViewer: true,
      }),
    );
  };

  const handleNewMessage = (data: { fromRole: string; msg: any; projectId?: string | number }) => {
    applyMonitorMsg(data);
    const fromRole = data?.fromRole;
    if (fromRole && fromRole !== "tl") playNotification();
  };

  const handleMessageAck = (data: { fromRole: string; msg: any; projectId?: string | number }) => {
    applyMonitorMsg(data);
  };

const handleEdited = (data: any) => {
  if (String(data.projectId) !== String(projectDetails?.project_id)) return;

  setChatMessages((prev) =>
    prev.map((m) => {
      if (!matchesChatMessage(m, data)) return m;
      return {
        ...m,
        message: data.newData ?? data.newText ?? m.message,
        edited: true,
        editedAt: data.editedAt || new Date().toISOString(),
      };
    })
  );
};

const handleDeleted = (data: any) => {
  if (String(data.projectId) !== String(projectDetails?.project_id)) return;

  setChatMessages((prev) =>
    prev.map((m) => {
      if (!matchesChatMessage(m, data)) return m;
      return {
        ...m,
        isDeleted: true,
        deletedAt: data.deletedAt || new Date().toISOString(),
        message: undefined,
        file: undefined,
      };
    })
  );
};
const handleProjectStatusUpdated = (data: { projectId: string | number; status: string }) => {
  if (String(data.projectId) !== String(projectDetails?.project_id)) return;
  setProjectDetails((prev) => (prev ? { ...prev, status: data.status } : prev));
};

  const handleChats = (data: any) => {
    if (data?.projectId && String(data.projectId) !== String(projectDetails?.project_id || item?.project_id)) {
      return;
    }
    setTlMonitorChats(data);
  };

  socket.on("tlMonitorChats", handleChats);
  socket.on("tlMonitorChatsUpdate", (payload: any) => handleChats(payload?.data || payload));
  socket.on("newTLMonitorMessage", handleNewMessage);
  socket.on("messageAck", handleMessageAck);
  socket.on("tlMonitorMessageEdited", handleEdited);
  socket.on("tlMonitorMessageDeleted", handleDeleted);
  socket.on("projectStatusUpdated", handleProjectStatusUpdated);

  return () => {
    socket.off("tlMonitorChats", handleChats);
    socket.off("tlMonitorChatsUpdate");
    socket.off("newTLMonitorMessage", handleNewMessage);
    socket.off("messageAck", handleMessageAck);
    socket.off("tlMonitorMessageEdited", handleEdited);
    socket.off("tlMonitorMessageDeleted", handleDeleted);
    socket.off("projectStatusUpdated", handleProjectStatusUpdated);
  };
}, [socket, projectDetails?.project_id, storedUserRole, playNotification, myEmployeeId, item?.project_id]);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const idx = target.dataset.idx;
            if (idx) {
              const msg = chatMessages[parseInt(idx)];
              const viewer =
                storedUserRole === "Team Leader" ? "tl" : "employee";
              if (
                msg &&
                msg.isLeft &&
                !msg.fromClient && // Skip marking for client updates
                !(viewer === "tl" ? msg.seen_by.includes("tl") : seenByEmployee(msg.seen_by)) &&
                msg.id !== undefined
              ) {
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
  }, [chatMessages, projectDetails?.project_id,socket, onEvent]);

  // thisss
//   useEffect(() => {
//   const handleVisibility = () => {
//     if (document.visibilityState === 'visible') {
//       fetchTlMonitorChats(); // Or fetchProject(true);
//     }
//   };
//   document.addEventListener('visibilitychange', handleVisibility);
//   return () => document.removeEventListener('visibilitychange', handleVisibility);
// }, [fetchTlMonitorChats]);

  useEffect(() => {
    const currentObserver = observer.current;
    if (currentObserver) {
      currentObserver.disconnect();
      chatMessages.forEach((msg, idx) => {
        if (msg.isLeft && !msg.fromClient) {
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
    if (!projectDetails?.project_id || msg.id === undefined || msg.fromClient) return;
    let messageType =
      msg.type === "file" && msg.file?.type.startsWith("audio/")
        ? "audio"
        : "chat";
    let fromTL = msg.fromTL;
    const viewer = storedUserRole === "Team Leader" ? "tl" : "employee";
    try {
      const response = await postData(
        `clientproject/mark_tl_monitor_message_seen/${projectDetails.project_id}`,
        {
          index: msg.id,
          fromTL,
          type: messageType,
          viewer,
          timestamp: msg.timestamp // Pass timestamp for emit
        }
      );
      if (response.status) {
        // Optimistic update using timestamp + fromTL
        setChatMessages((prev) =>
          prev.map((m) =>
            (m.timestamp === msg.timestamp && m.fromTL === fromTL)
              ? { ...m, seen_by: [...new Set([...m.seen_by, viewer])] }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Error marking message as seen:", error);
    }
  };

  const isSeenByReceiver = (msg: ChatMessage) => {
    if (msg.isLeft || msg.fromClient) return false; // No checkmark on received or client updates
    const receiver = storedUserRole === "Team Leader" ? "employee" : "tl";
    return receiver === "employee" ? seenByEmployee(msg.seen_by) : msg.seen_by.includes(receiver);
  };

  const getSeenText = (msg: ChatMessage) => {
    if (msg.fromClient) return ""; // No seen text for updates
    if (msg.seen_by.length === 0) return "Not seen yet";
    let text = "";
    const tlName =
      tlMonitorChats?.teamleadername ||
      parsedData?.employeeName;
    const receiverName =
  chatMessages.find(
    m => !m.fromTL && m.senderName?.trim()
  )?.senderName || "Employee";
    if (msg.seen_by.includes("tl")) {
      text += `Team Leader (${tlName})`;
    }
    if (seenByEmployee(msg.seen_by)) {
      if (text) text += ", ";
      text += `Employee (${receiverName})`;
    }
    return `Seen by ${text}`;
  };

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      if (autoScrollRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
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
    setShowScrollToBottom(false);
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
      return date.toLocaleDateString("en-GB");
    }
  };

const handleSendMessage = async (
  message: string,
  type: "text" | "voice" | "file" = "text",
  files?: { name: string; url: string; type: string; blob?: Blob }[],
  caption?: string,
) => {
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
      const senderId = parsedData?.employeeId || "default_id";
      const tempId = uuidv4();

      // === ALWAYS use the new unified event ===
      const emitEvent = "sendTLToMonitorMessage";

      if (type === "text" && message.trim()) {
        const optimisticMsg: ChatMessage = {
          message,
          isLeft: false,
          fromTL: true,                    // ← Team Leader side
          type: "text",
          timestamp,
          seen_by: [],
          tempId,
          replyTo: replyToMessage || null,
          senderId: senderId.toString(),           // ← IMPORTANT
          senderName: parsedData?.employeeName || "You",
          senderPic: parsedData?.employeePic || "",
        };

        setChatMessages((prev) => [...prev, optimisticMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));

        socket.emit(emitEvent, {
          projectId: projId,
          type: "text",
          msgData: message,
          timestamp,
          senderId,
          senderName: parsedData?.employeeName,
          senderPic: parsedData?.employeePic,
          tempId,
          replyTo: replyToMessage || null,
        });

        setNewMessage("");
        playNotification();
      } 
      else if (type === "voice" && files && files[0]?.blob) {
        const file = files[0];
        const formData = new FormData();
        formData.append("file", file.blob!, file.name);
        formData.append("projectId", projId);

        const uploadResponse = await postData(`clientproject/upload_file`, formData);
        if (uploadResponse.status) {
          const url = uploadResponse.data?.fileUrl || "";
          if (url) {
            const optimisticMsg: ChatMessage = {
              file: {
                name: file.name,
                url: `${serverURL}${url}`,
                type: file.type || "audio/mp3",
              },
              isLeft: false,
              fromTL: true,
              type: "file",
              timestamp,
              seen_by: [],
              tempId,
              replyTo: replyToMessage || null,
              senderId: senderId.toString(),
              senderName: parsedData?.employeeName || "You",
              senderPic: parsedData?.employeePic || "",
            };

            setChatMessages((prev) => [...prev, optimisticMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));

            socket.emit(emitEvent, {
              projectId: projId,
              type: "audio",
              msgData: { name: file.name, url, type: file.type || "audio/mp3" },
              timestamp,
              senderId,
              senderName: parsedData?.employeeName,
              senderPic: parsedData?.employeePic,
              tempId,
              replyTo: replyToMessage || null,
            });
          }
        }
      } 
      else if (type === "file" && files && files.length > 0) {
        const fileObjects = files
          .filter((f): f is { name: string; url: string; type: string; blob: Blob } => !!f.blob)
          .map((f) =>
            f.blob instanceof File
              ? f.blob
              : new File([f.blob], f.name, {
                  type: normalizeMimeType(f.type || f.blob.type, f.name),
                }),
          );
        if (fileObjects.length > 0) {
          addChatFiles(fileObjects, {
            caption: caption || message.trim() || undefined,
            replyTo: replyToMessage || null,
          });
          setReplyToMessage(null);
          setNewMessage("");
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
      setReplyToMessage(null);
    }
  }
};

    const getReadableFileType = (type?: string, name?: string) => {
    const fileType = normalizeMimeType(type, name);
    if (isChatAudioFile(fileType, name)) return "AUDIO";
    if (fileType === "application/pdf") return "PDF";
    if (
      fileType === "application/msword" ||
      fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
      return "DOC";
    if (fileType === "application/zip") return "ZIP";
    if (fileType.startsWith("video/")) return "VIDEO";
    if (fileType.startsWith("image/")) return "IMAGE";
    return "FILE";
  };

  const handleOpenPreview = (file: File | undefined, msg: ChatMessage) => {
    if (file) {
      setSelectedFile(file);
      setIsModalOpen(true);
      const isReceived = msg.isLeft;
      const viewer = storedUserRole === "Team Leader" ? "tl" : "employee";
      if (isReceived && !msg.seen_by.includes(viewer) && msg.id !== undefined) {
        markMessageAsSeen(msg);
      }
    }
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

  const handleDownloadFile = async (url: string, name: string) => {
    try {
      await downloadChatFile(url, name);
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
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen, isModalOpen]);

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

const getSenderInfo = (msg: ChatMessage) =>
  formatMonitorSenderLabel({
    msg,
    myId: String(parsedData?.employeeId || ""),
    myRoleLabel: "TEAM LEADER",
    clientName: projectDetails?.clientName,
    tlFallbackName:
      tlMonitorChats?.teamleadername || parsedData?.employeeName || "Team Leader",
  });

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  // const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;
  const highlightMessageText = (text: string) => {
  if (!text) return text;

  let highlighted = text;
  // Existing @update highlighting (unchanged)
 highlighted = highlighted.replace(
      /(@update_[^:\n]+:)/g,
      '<span style="color: #4DD60B; font-weight: 500;">$1</span>'
    );


  return highlighted;
};

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
        <div
          className={`w-full ${
            isLG ? "px-16" : isXL || is2XL ? "px-24" : "px-4"
          } items-start flex mb-8 flex-col`}
        >
          
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
                  <h2 className="text-lg font-semibold text-gray-800">
                    Progress
                  </h2>
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
              </div>
            )}
            {isDrawerOpen && !isLG && !isXL && !is2XL && (
              <div
                className="fixed inset-0 bg-white/30 backdrop-blur-xs w-full z-40"
                onClick={toggleDrawer}
              ></div>
            )}
            {isLG || isXL || is2XL ? (
              <div className="flex justify-center">
    <ProgressTracking
      progress={progress}
      onStepClick={dept === 'Technical' ? handleStepClick : undefined}
      updateType={dept === 'Technical' ? 'work' : undefined}
    />
  </div>
            ) : null}
            <div className="w-full flex flex-col space-y-7">
              <div
                ref={descriptionRef}
                className={`w-full grid ${
                  isLG || isXL || is2XL
                    ? "grid-cols-2 gap-16"
                    : "grid-cols-1 gap-4"
                }`}
              >
                <div className="flex flex-col items-start space-y-4">
                  <div className="mb-4 ">
            <Button1 value={item.workstream || ""} gradientType="gradient1" />
          </div>
          <div>
            <div className="leading-relaxed flex items-start flex-col">
              <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                {item?.clientName}
              </div>
              <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                Project ID:{" "}
                <span className="font-semibold">
                  {projectDetails?.project_id}
                </span>
              </div>
              <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                Submission Date:{" "}
                <span className="">
                  {new Date(projectDetails?.deadline ?? "").toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})}
                  
                </span>
              </div>
              {projectDetails?.assignedEmployees && (
                <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                  Assigned Employees:{" "}
                  <span className="font-semibold">
                    {projectDetails.assignedEmployees}
                  </span>
                </div>
              )}
            </div>
          </div>
                <div className="w-full text-start rounded-xl border border-gray-200 flex flex-col items-start bg-white p-6 shadow-sm">
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
                    className={`w-full ${is2XL ? "text-[14px]" : "text-[12px]"} flex flex-col space-y-4 items-start`}
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
                    </div>
                    <div className="max-h-[200px] w-full mb-4 overflow-y-auto thin-scroll">
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
                     <div className="flex flex-col w-full space-y-3 sm:flex-row sm:justify-between sm:space-y-0">
                        <div className="flex items-center gap-x-1 text-gray-500">
                          <RiTimeLine size={15} color="#FF0A78" />
                          <span className="font-semibold text-gray-800">
                            {new Date(projectDetails?.deadline || "").toLocaleDateString("en-GA")}
                          </span>
                        </div>
                      </div>
                  </div>
                </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-end items-center gap-2 flex-wrap">
 <div className="flex items-center w-fit gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full transition-all duration-200 cursor-default">
  {/* Live Indicator Dot */}
  <span className="flex w-2 h-2 bg-emerald-500 rounded-full"></span>
  
  <p className="text-sm text-gray-600">
    Talking with <span className="font-semibold text-gray-900">Employee</span>
  </p>
</div>
                  <div
                    onClick={() =>
                      navigate("/teamleaderprojectinfo", {
                        state: {
                          item: projectDetails || item,
                        },
                      })
                    }
                    className="flex cursor-pointer items-center w-fit gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
                  >
                    <MdSwapHoriz size={16} />
                    <span>
                      Switch to{" "}
                      <span className="font-semibold">Client & Head</span>
                    </span>
                  </div>
</div>
<div
  className={`w-full md:min-h-[400px] min-h-[300px] md:max-h-[650px] max-h-[550px] flex flex-col items-center justify-between pb-4 
  ${isChatDisabled ? 'bg-[#dddddd]' : 'bg-gradient-to-t from-[#f0f9fd] to-[#CFE3FF]'}
  ring-1 ring-inset ring-cyan-100/50
  text-slate-500 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)] shadow-[#8A8A8A] rounded-[10px]`}
>
<div className="w-full relative items-center md:h-[600px] h-[500px] md:max-h-[600px] max-h-[500px] justify-start flex flex-col">
  <div
    className="flex items-center w-fit rounded-md justify-center text-white"
    style={{
    background: isCompleted || isChatDisabled
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
      className=" w-fit px-3 py-1 text-[12px] cursor-pointer bg-blue-600/90 text-white rounded-full mr-4 hover:bg-blue-700"
    >
      {isFileSelectionMode ? "Cancel" : (
  <div className="flex items-center gap-x-2">
    Select Messages <BiSolidSelectMultiple size={18} />
  </div>
)} 
    </div>
    </div>
                
  <div
    ref={chatContainerRef}
    className={`w-full px-4 rounded-md ${is2XL ? "text-sm" : "text-xs"} overflow-y-auto thin-scroll space-y-2`}
    style={{
      paddingTop: "16px",
      paddingBottom: previewHeight > 0 ? previewHeight + 20 : 30,
    }}
  >
    {(() => {
      let currentDate = "";
      let displayedMessages = chatMessages;
      if (currentTab === "files") {
        displayedMessages = chatMessages.filter(
          (msg) => msg.type === "file"
        );
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
                <div
                  className="w-full h-[0.5px] bg-blue-400/30"></div>
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
          <React.Fragment key={`${msg.timestamp}-${msg.id || index}`}>
            {dateHeader}
            <div
            ref={(el) => {
  messageRefs.current[`${index}`] = el;
}}
              className={`flex ${
                msg.isLeft ? "justify-start" : "justify-end"
              } my-2`}
            >
              <div
                className={`flex ${
                  isXXS || isXS || isSM
                    ? "w-[85%]"
                    : isLG || isXL
                    ? "w-[60%]"
                    : "w-[40%]"
                } items-center ${
                  msg.isLeft ? "flex-row" : "flex-row-reverse"
                }`}
              >
                <div
                  className={`w-8 h-8 ${
                    !msg.isLeft ? "ml-2" : "mr-2"
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
  src={
    msg.senderPic
      ? `${serverURL}/files/${msg.senderPic}`
      : msg.fromTL
      ? `${serverURL}/files/${tlMonitorChats?.teamleaderpic || ""}`
      : UserIcon
  }
  alt="Profile"
  className="w-10 h-8 rounded-full border-2 border-blue-500/50"
  onError={(e) => { e.currentTarget.src = UserIcon; }}
/>
                  )}
                </div>
                <div
                  className={`${
                    msg.isLeft
                      ? `${
                          isSM || isXS || isXXS ? "pr-0" : " "
                        }`
                      : `${isSM || isXS || isXXS ? "" : ""}`
                  } relative p-1 text-start w-fit `}
                >
                  <div className="flex items-center mb-1 group">
      {/* The Technical Accent Bar */}
      <div className="h-4 w-[2px] bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>

      <div className="flex items-center gap-1 bg-[#f6fff2] backdrop-blur-sm px-2 py-0.5 rounded-r-sm border-l border-white/50">
        {/* From Name */}
        <span className="text-[9px] font-black text-blue-950 tracking-wide uppercase font-sans">
          {sender.name}
        </span>

        {/* Small Technical Separator */}
        <span className="text-[8px] text-blue-300 font-mono select-none">
          |
        </span>

        {/* From Role - High Contrast Red */}
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
                        onClick={() => handleClickOnReplyBubble(msg.replyTo!)}
                        className="mb-2 p-2 bg-[#ececec] rounded-md border-l-4 border-blue-500 cursor-pointer hover:bg-gray-200 transition"
                      >
                        <div className="text-xs font-medium text-gray-600">
                          {(() => {
                            const replySenderRole = msg.replyTo!.sender;
                            const isCurrentUserTL = storedUserRole === "Team Leader";
                            if (replySenderRole.includes("You")) return replySenderRole;
                            if (replySenderRole.includes("Team Leader") && isCurrentUserTL) return "You";
                            if (replySenderRole.includes("Monitor") || replySenderRole.includes("Employee")) return "You";
                            return replySenderRole;
                          })()}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {msg.replyTo.content}
                        </div>
                      </div>
                    )}

                    {msg.isDeleted ? (
  <div className="text-gray-400 italic text-xs flex items-center gap-1 py-1">
    <MdBlock size={14} /> {msg.isLeft ? "This message was deleted" : "You deleted this message"}
  </div>
) : (
  <div className="relative">
    {/* Checkbox for BOTH text and file messages */}
    {isFileSelectionMode && (
      <input
        type="checkbox"
        checked={selectedFileTimestamps.has(msg.timestamp)}
        onChange={() => toggleFileSelect(msg.timestamp)}
        className="absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 border-blue-500 bg-white/90 checked:bg-blue-600 cursor-pointer"
      />
    )}

    {/* ===== TEXT MESSAGE ===== */}
    {msg.type === "text" && msg.message && (
      <div className={`${isFileSelectionMode ? "pl-8" : ""}`}>
        <div
          className="text-gray-900 leading-snug break-words hyphens-auto"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(highlightMessageText(msg.message)),
          }}
        />
      </div>
    )}

    {/* ===== FILE MESSAGE ===== */}
    {msg.file && msg.file.url && msg.file.name && (
      <div className={`${isFileSelectionMode ? "ml-7" : ""}`}>
        <div
          ref={index === msgControl ? divRef : null}
          onClick={() => setMsgControl(msgControl === index ? null : index)}
          className={`group relative mt-1 h-fit shadow-sm shadow-amber-200 max-w-[300px] cursor-pointer rounded-xl border border-slate-200 bg-white transition-all duration-300 ease-out hover:border-slate-400 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] active:scale-[0.985] ${
            isChatAudioFile(msg.file.type, msg.file.name) ? "overflow-visible" : "overflow-hidden"
          }`}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            {(() => {
              const fileType = normalizeMimeType(msg.file.type, msg.file.name);
              let Icon = FaFileInvoice;
              let color = "text-slate-600";

              if (isChatAudioFile(fileType, msg.file.name)) { Icon = FaFileAudio; color = "text-orange-500"; }
              else if (fileType.startsWith("image/")) { Icon = FaFileImage; color = "text-emerald-500"; }
              else if (fileType.startsWith("video/")) { Icon = FaFileVideo; color = "text-violet-500"; }
              else if (fileType === "application/pdf") { Icon = FaFilePdf; color = "text-rose-500"; }
              else if (fileType === "application/msword" || fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") { Icon = FaFileWord; color = "text-sky-600"; }
              else if (fileType === "application/zip") { Icon = FaFileArchive; color = "text-amber-500"; }
              else if (fileType === "text/html") { Icon = FaRegFileAlt; color = "text-amber-500"; }

              return (
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 ${color}`}>
                  <Icon size={18} />
                </div>
              );
            })()}

            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-medium text-slate-800">{msg.file.name}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{getReadableFileType(msg.file.type, msg.file.name)}</p>
            </div>
          </div>

          {(() => {
            const name = msg.file.name;
            const fileType = normalizeMimeType(msg.file.type, name);
            const url = msg.file.url.startsWith("blob:") ? msg.file.url : `${msg.file.url}`;

            if (isChatAudioFile(fileType, name)) {
              return <div className="px-3 py-2 border-t border-gray-200"><audio controls src={url} className="min-w-[150px] max-w-full" /></div>;
            } else if (fileType.startsWith("image/")) {
              return (
                <div className="px-0 pb-2 relative border-t border-gray-200 h-[100px] flex items-center justify-center">
                  <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
                  {msgControl === index && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                      <ActionBar msg={msg} index={index} url={url} name={name} />
                    </div>
                  )}
                </div>
              );
            } else if (fileType.startsWith("video/")) {
              return <div className="px-0 py-0 border-t border-gray-200"><video controls src={url} className="w-full max-h-[100px] object-contain" /></div>;
            } else if (
              ["text/html", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"].includes(fileType)
              || (name || "").toLowerCase().endsWith(".zip")
            ) {
              return <div className="px-3 flex items-center justify-center">{msgControl === index && <ActionBar msg={msg} index={index} url={url} name={name} />}</div>;
            }
            return null;
          })()}
          {msg.caption && (
            <div className="px-3 pb-3 text-gray-800 text-[13px] break-words leading-snug border-t border-slate-100 pt-2">
              {msg.caption}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
)}

                    <div className={`text-xs text-gray-500 mt-1 ${msg.isLeft ? "text-left" : "text-right"}`}>
                      {msg.edited && !msg.isDeleted && (
                        <span className="text-[10px] text-amber-500 mr-1 italic">edited</span>
                      )}
                      {formatChatTime(msg.timestamp)}
                      {!msg.isLeft && (
                        <span className="inline-flex items-center ml-1">
                          <IoCheckmarkDoneSharp size={14} color={isSeenByReceiver(msg) ? "#00B7FF" : "#000000"} className="inline-block" />
                          <FaInfoCircle size={12} color="#808080" title={getSeenText(msg)} className="inline-block ml-1 cursor-help" />
                        </span>
                      )}
                    </div>

                    {!msg.isLeft && !msg.isDeleted && (
                      <div className="relative flex justify-end mt-1">
                        <div
                          className="cursor-pointer p-0.5 rounded-full hover:bg-gray-200 text-gray-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMessageMenuIndex(messageMenuIndex === index ? null : index);
                          }}
                        >
                          <BsThreeDotsVertical size={13} />
                        </div>

                        {messageMenuIndex === index && (
                          <div className="absolute bottom-6 right-0 bg-white shadow-xl rounded-xl border border-gray-100 z-50 min-w-[110px] overflow-hidden">
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
                  </div>
                </div>

                {msg.isLeft && !isCompleted && (
                  <div
                    onClick={() => handleReplyToMessage(msg)}
                    className="transition-all duration-200 cursor-pointer p-0.5 rounded-full bg-slate-50 border border-slate-300 flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] hover:bg-slate-800 hover:text-white hover:border-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(59,130,246,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-slate-500"
                  >
                    <MdOutlineReply size={15} />
                  </div>
                )}
                {!msg.isLeft && !isCompleted && (
                  <div
                    onClick={() => handleReplyToMessage(msg)}
                    className="transition-all duration-200 cursor-pointer p-0.5 rounded-full bg-slate-50 border border-slate-300 flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] hover:bg-slate-800 hover:text-white hover:border-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(59,130,246,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-slate-500"
                  >
                    <MdOutlineReply className="scale-x-[-1]" size={15} />
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
        className="bottom-4 cursor-pointer absolute right-4 w-fit z-10 p-1.5 bg-[#9C9C9C] text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300"
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
          Forward to Main Chat
        </div>

        {/* Secondary Action: Subtle but accessible */}
        <div
          onClick={() => {
            setSelectedFileTimestamps(new Set());
            setIsFileSelectionMode(false);
          }}
          className="px-3 cursor-pointer py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </div>
      </div>
    </div>
  </div>
)}
      {/* WhatsApp-style chunked upload bubbles */}
      {Object.values(uploadTasks).map((task) => (
        <div key={task.id} className="flex justify-end my-2 w-full px-1">
          <FileUploadBubble
            task={task}
            align="right"
            onPause={() => pauseUpload(task.id)}
            onResume={() => resumeUpload(task.id)}
            onCancel={() => cancelUpload(task.id)}
            onRetry={() => retryUpload(task.id)}
          />
        </div>
      ))}
  </div>
  
</div>
<div className="w-[90%]">
                <MikeSearch
                disabled={isChatDisabled}
  value={newMessage}
  onChange={(e) => setNewMessage(e.target.value)}
  onKeyDown={handleKeyDown}
  onSend={(message, type, files, caption) => {
    if (editingMessage) {
      sendEditedMessage();
    } else {
      handleSendMessage(message, type, files, caption);
    }
  }}
  placeholder={editingMessage ? "Edit your message..." : "Type your message..."}
  onPreviewHeightChange={handlePreviewHeightChange}
  inputRef={inputRef}
  replyTo={replyToMessage} // NEW: Pass replyTo prop
  onCancelReply={() => setReplyToMessage(null)} // NEW: Pass cancel handler
  projectId={projectDetails?.project_id}
  allowedFileTypes={["*/*"]}
/>
</div>
              </div>
              </div>
            </div>
            </div>
          </div>
        </div>
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
  );
};

export default TeamLeaderProjectInfoWithEmployee;