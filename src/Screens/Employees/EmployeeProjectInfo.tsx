import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Button1 from "../../UI_Components/Buttons/Button1";
import Button2 from "../../UI_Components/Buttons/Button2";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import MikeSearch from "../../UI_Components/SearchBars/MikeSearch";
import { postData, getData, serverURL } from "../../BackendConnections/FetchBackendServices";
import { FaInfoCircle, FaFileAudio, FaFileImage, FaFileInvoice, FaFileVideo, FaRegFileAlt, FaFilePdf, FaFileArchive, FaFileWord } from "react-icons/fa";
import { FiDownload, FiX, FiZoomIn } from "react-icons/fi";
import { IoCheckmarkDoneSharp } from "react-icons/io5";
import DOMPurify from "dompurify";
import useSound from "use-sound";
import notificationSound from "../../assets/CredientialAssets/Chat_Notification_Sound.mp3";
import UserIcon from "../../assets/CredientialAssets/UserLogo.png";
import { Commet } from "react-loading-indicators";
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from "../../BackendConnections/useSocket";
import { TbListDetails } from "react-icons/tb";
import { MdDelete, MdEdit, MdOutlineDoubleArrow, MdOutlineReply, MdBlock } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";

interface ChatMessage {
  type: "text" | "file";
  isLeft: boolean;
  fromTL: boolean;
  fromClient?: boolean; // Added for client messages in updates
  message?: string;
  file?: { url: string; name: string; type: string; blob?: Blob };
  timestamp: string;
  seen_by: string[];
  id?: number;
  tempId?: string;
  replyTo?: ReplyMessage | null; // NEW
  senderName?: string;
  senderPic?: string;   // ← NEW
  senderId?: string;
  edited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}
interface File {
  url: string;
  name: string;
  type: string;
}
interface ProjectDetails {
  project_id: string;
  workstream: string;
  title: string;
  deadline: string;
  budget: string;
  description: string | string[];
  clientName?: string;
  clientPic?: string;
  headPic?: string;
  headName?: string;
  assignedEmployees?: string;
  clientid?: string;
  headid?: string;
  clientchats?: string[]; // Added for parsing client updates
  clientaudios?: string[]; // Added for parsing client updates
  status?: string;
  // ← ADD THESE TWO LINES
  teamLeaderName?: string;
  teamLeaderPic?: string;
}
interface UpdateItem {
  number: number;
  title: string;
  messageTimestamp: string;
  isText: boolean;
}
interface ReplyMessage {
  id: number;
  sender: string; // e.g., "Team Leader", "You", "Client"
  content: string; // Truncated original message or file name
  type: "text" | "file";
  timestamp: string;
}
const EmployeeProjectInfo: React.FC = () => {
  const [width, setWidth] = useState(window.innerWidth);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [animate, setAnimate] = useState(false);
  const [sending, setSending] = useState(false);     // ← for messages
const [isRequesting, setIsRequesting] = useState(false);  // ← for Request button
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [tlMonitorChats, setTlMonitorChats] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [clientUpdateMessages, setClientUpdateMessages] = useState<ChatMessage[]>([]); // Renamed for clarity
  const [combinedMessages, setCombinedMessages] = useState<ChatMessage[]>([]); // Added for combined view
  const [newMessage, setNewMessage] = useState<string>("");
  const [previewHeight, setPreviewHeight] = useState<number>(0);
  const [currentTab, setCurrentTab] = useState<"chat" | "files">("chat");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [msgControl, setMsgControl] = useState<number | null>(null);
  const [playNotification] = useSound(notificationSound);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const observer = useRef<IntersectionObserver | null>(null);
  const autoScrollRef = useRef<boolean>(true);
  const prevMessagesLengthRef = useRef(0);
  const location = useLocation();
  const { item } = location.state || {};
  const userData = atob(localStorage.getItem("userData") || "");
  const employeeData = JSON.parse(userData);
  console.log('test',employeeData)
  const { socket, connected } = useSocket();
  const [updatesList, setUpdatesList] = useState<UpdateItem[]>([]);
  const [isUpdatesLoading, setIsUpdatesLoading] = useState(true);
  const [replyToMessage, setReplyToMessage] = useState<ReplyMessage | null>(null);
const isCompleted = projectDetails?.status === "Completed";
const isChatDisabled = projectDetails?.status === "Completed" || projectDetails?.status === "Hold";

const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
const [messageMenuIndex, setMessageMenuIndex] = useState<number | null>(null);
const [showTimeLimitPopup, setShowTimeLimitPopup] = useState(false);

const isWithinEditWindow = (msg: ChatMessage): boolean => {
  if (!msg.timestamp) return false;
  return Date.now() - new Date(msg.timestamp).getTime() < 2 * 60 * 1000;
};

const [isChatEligible, setIsChatEligible] = useState(false);

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
    fromTL: false,
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

  // Optimistic
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
    fromTL: false, // Employee message
  });
};


const handleReplyToMessage = (msg: ChatMessage) => {
const sender = msg.fromTL
? "Team Leader"
: msg.fromClient
? "Client"
: "You";
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
  const repliedMsg = combinedMessages.find((m) => m.timestamp === reply.timestamp);
  if (repliedMsg) {
    const index = combinedMessages.indexOf(repliedMsg);
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

  // Check request status from backend on mount
  useEffect(() => {
    const checkRequestStatus = async () => {
      if (!item.project_id || !employeeData?.employeeId) {
        console.error("Missing required data:", { project_id: item.project_id, employeeId: employeeData?.employeeId });
        setError("Missing project or employee data. Please ensure valid data is provided.");
        setAnimate(true);
        setTimeout(() => setAnimate(false), 1000);
        return;
      }
      try {
        const body = {
          project_id: item.project_id,
          employeeId: employeeData.employeeId,
        };
        console.log("Sending check request with:", body);
        const response = await postData("clientproject/check_request", body);
        console.log("Received response:", response);
        if (response.status && response.data?.exists) {
          setRequestStatus(response.data.status); // Set the status from DB
        } else {
          setRequestStatus(null); // No request exists
        }
      } catch (err) {
        console.error("Error checking request status:", err);
        setError("Failed to check request status. Please try again.");
        setAnimate(true);
        setTimeout(() => setAnimate(false), 1000);
      }
    };
    checkRequestStatus();
  }, [item.project_id, employeeData?.employeeId]);
  // Fetch project details
  const fetchProject = async () => {
    try {
      const response = await getData(`clientproject/get_project/${item.project_id}`);
      if (response.status) {
        setProjectDetails(response.data);
      }
    } catch (error) {
      console.error("Error fetching project data:", error);
    }
  };
  useEffect(() => {
    if (item?.project_id) {
      fetchProject();
    }
  }, [item]);

useEffect(() => {
  const checkEligibility = async () => {
    if (!item?.project_id || !employeeData?.employeeId) {
      setIsChatEligible(false);
      return;
    }
    try {
      const res = await getData(
        `clientproject/is_employee_chat_eligible/${item.project_id}/${employeeData.employeeId}`
      );
      if (res?.status) {
        setIsChatEligible(!!res.showChat);
      } else {
        setIsChatEligible(false);
      }
    } catch (err) {
      console.error("Eligibility check failed:", err);
      setIsChatEligible(false);
    }
  };

  checkEligibility();
}, [item?.project_id, employeeData?.employeeId]);

useEffect(() => {
  setShowChat(isChatEligible && !isCompleted);
}, [isChatEligible, isCompleted]);


  // Socket connection and event listeners
useEffect(() => {
  if (socket && connected && showChat && item?.project_id) {
    const projectId = item.project_id;
    socket.emit("joinEmployeeChat", projectId);
    socket.emit("requestTLMonitorChats", projectId);
    socket.emit("joinEmployeeRoom", employeeData.employeeId);   // ← ADD THIS LINE

    const handleChats = (data: any) => {
      console.log("🔥 1. RAW DATA FROM BACKEND:", data);
      console.log("🔥 2. FIRST MONITOR CHAT SENDER NAME:", data?.monitorchats?.[0]?.senderName);
      setTlMonitorChats(data);
    };

    const handleNewMessage = (data: { fromRole: string; msg: any }) => {
      const { fromRole, msg: incoming } = data;
      setChatMessages((prev) => {
        const isDuplicate = prev.some((m) =>
          m.timestamp === incoming.timestamp &&
          ((m.type === "text" && m.message === incoming.data) ||
           (m.type === "file" && m.file?.name === incoming.data.name))
        );
        if (isDuplicate) return prev;
        const existingIndex = prev.findIndex((m) => m.tempId === incoming.tempId);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            id: incoming.id,
            tempId: undefined,
          };
          return updated.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        } else {
          const fromTL = fromRole === "tl";
          const isLeft = incoming.senderId !== employeeData.employeeId;
          const newMsg: ChatMessage = {
            type: incoming.type === "text" ? "text" : "file",
            isLeft,
            fromTL,
            timestamp: incoming.timestamp,
            seen_by: incoming.seen_by,
            id: incoming.id,
            replyTo: incoming.replyTo || null,
            senderId: incoming.senderId,
            senderName: incoming.senderName,
            senderPic: incoming.senderPic || "",
          };
          if (incoming.type === "text") {
            newMsg.message = incoming.data;
          } else {
            newMsg.file = {
              name: incoming.data.name,
              url: `${serverURL}${incoming.data.url}`,
              type: incoming.data.type,
            };
          }
          const updated = [...prev, newMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          return updated;
        }
      });
      playNotification();
    };

    const handleMessageSeen = (data: { fromTL: boolean; timestamp: string; seen_by: string[] }) => {
      const { fromTL, timestamp, seen_by } = data;
      setChatMessages((prev) => prev.map((m) => {
        if (m.timestamp === timestamp && m.fromTL === fromTL) {
          return { ...m, seen_by };
        }
        return m;
      }));
    };

const handleEdited = (data: any) => {
  if (String(data.projectId) !== String(item?.project_id)) return;

  console.log("✏️ Employee received EDIT event:", data);

  const updateFn = (m: ChatMessage) => {
    const timeDiff = Math.abs(
      new Date(m.timestamp).getTime() - new Date(data.timestamp).getTime()
    );
    if (timeDiff < 10000) {
      return {
        ...m,
        message: data.newData,
        edited: true,
        editedAt: data.editedAt || new Date().toISOString(),
      };
    }
    return m;
  };

  setChatMessages((prev) => prev.map(updateFn));
  setCombinedMessages((prev) => prev.map(updateFn));
};

const handleDeleted = (data: any) => {
  if (String(data.projectId) !== String(item?.project_id)) return;

  console.log("🗑️ Employee received DELETE event:", data);

  const updateFn = (m: ChatMessage) => {
    const timeDiff = Math.abs(
      new Date(m.timestamp).getTime() - new Date(data.timestamp).getTime()
    );
    if (timeDiff < 10000) {
      return {
        ...m,
        isDeleted: true,
        deletedAt: data.deletedAt || new Date().toISOString(),
        message: undefined,
        file: undefined,
      };
    }
    return m;
  };

  setChatMessages((prev) => prev.map(updateFn));
  setCombinedMessages((prev) => prev.map(updateFn));
};

// ==================== NEW: Employee Removed ====================
const handleEmployeeRemoved = (data: { projectId: number | string; employeeId: number | string }) => {
  if (
    String(data.projectId) === String(item?.project_id) &&
    String(data.employeeId) === String(employeeData.employeeId)
  ) {
    setIsChatEligible(false);
    setShowChat(false);
    alert("You have been removed from this project by the Team Leader.");
  }
};

// ==================== NEW: Project Hold / Active ====================
const handleProjectStatusUpdated = (data: { projectId: string | number; status: string }) => {
  if (String(data.projectId) !== String(item?.project_id)) return;
  setProjectDetails((prev) => (prev ? { ...prev, status: data.status } : prev));
};
// ==============================================================

socket.on("tlMonitorChats", handleChats);
socket.on("newTLMonitorMessage", handleNewMessage);
socket.on("tlMonitorMessageSeen", handleMessageSeen);
socket.on("tlMonitorMessageEdited", handleEdited);
socket.on("tlMonitorMessageDeleted", handleDeleted);
socket.on("employeeRemovedFromProject", handleEmployeeRemoved);
socket.on("projectStatusUpdated", handleProjectStatusUpdated);   // ← ADD THIS

    return () => {
  socket.off("tlMonitorChats", handleChats);
  socket.off("newTLMonitorMessage", handleNewMessage);
  socket.off("tlMonitorMessageSeen", handleMessageSeen);
  socket.off("tlMonitorMessageEdited", handleEdited);
  socket.off("tlMonitorMessageDeleted", handleDeleted);
  socket.off("employeeRemovedFromProject", handleEmployeeRemoved);
  socket.off("projectStatusUpdated", handleProjectStatusUpdated);   // ← ADD THIS
};
  }
}, [socket, connected, showChat, item, playNotification]);

useEffect(() => {
  if (!tlMonitorChats) return;

  const allMessages: ChatMessage[] = [];

  const processArray = (arr: any[] | undefined, isFromTL: boolean) => {
    if (!arr) return;

    let list = arr;
    if (typeof arr === "string") {
      try { list = JSON.parse(arr); } catch { return; }
    }
    if (!Array.isArray(list)) return;

    list.forEach((str, index) => {
      try {
        const parsed = typeof str === "string" ? JSON.parse(str) : str;

        const isOwnMessage = parsed.senderId 
          ? String(parsed.senderId) === String(employeeData.employeeId)
          : false;

        const msg: ChatMessage = {
          type: parsed.type === "text" ? "text" : "file",
          isLeft: isFromTL ? true : !isOwnMessage,
          fromTL: isFromTL,
          timestamp: parsed.timestamp,
          seen_by: parsed.seen_by || [],
          id: index,
          replyTo: parsed.replyTo || null,
          senderId: parsed.senderId,
          senderName: parsed.senderName || 
            (isFromTL ? tlMonitorChats.teamleadername : tlMonitorChats.monitorname) || 
            employeeData?.employeeName || "Employee",
          senderPic: parsed.senderPic || 
            (isFromTL ? tlMonitorChats.teamleaderpic : tlMonitorChats.monitorpic) || "",
          edited: !!parsed.edited,
          editedAt: parsed.editedAt,
          isDeleted: !!parsed.isDeleted,
          deletedAt: parsed.deletedAt,
        };

        if (parsed.type === "text") {
          msg.message = parsed.isDeleted ? undefined : parsed.data;
        } else if (parsed.data) {
          msg.file = parsed.isDeleted ? undefined : {
            name: parsed.data.name,
            url: `${serverURL}${parsed.data.url}`,
            type: parsed.data.type,
          };
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

  setChatMessages(allMessages);
  setCombinedMessages(allMessages);
}, [tlMonitorChats, employeeData.employeeId, employeeData.employeeName]);


  useEffect(() => {
    if (!projectDetails) return;
    let updateMessages: ChatMessage[] = [];
    const maxLengthClient = Math.max(projectDetails.clientchats?.length || 0, projectDetails.clientaudios?.length || 0);
    for (let i = 0; i < maxLengthClient; i++) {
      if (i < (projectDetails.clientchats?.length || 0)) {
        const chatStr = projectDetails.clientchats?.[i];
        if (typeof chatStr === "string") {
          try {
            const parsed = JSON.parse(chatStr);
            if (
              (parsed.type === "text" && parsed.data?.startsWith("@update_")) ||
              (parsed.type === "file" && parsed.data?.name?.startsWith("@update_") ||
              parsed.data?.name?.startsWith("@Update_"))
            ) {
              let timestamp = parsed.timestamp || new Date().toISOString();
              const msg: ChatMessage = {
                type: parsed.type === "text" ? "text" : "file",
                isLeft: true,
                fromTL: false,
                fromClient: true,
                timestamp,
                seen_by: parsed.seen_by || [],
                id: i,
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
              updateMessages.push(msg);
            }
          } catch (e) {
            console.error("Error parsing client chat:", e);
          }
        }
      }
      if (projectDetails.clientaudios && i < projectDetails.clientaudios.length) {
        const audioStr = projectDetails.clientaudios[i];
        try {
          const parsed = JSON.parse(audioStr);
          if (parsed.data?.name?.startsWith("@update_") || parsed.data?.name?.startsWith("@Update_")) {
            let timestamp = parsed.timestamp || new Date().toISOString();
            const msg: ChatMessage = {
              type: "file",
              isLeft: true,
              fromTL: false,
              fromClient: true,
              file: {
                name: parsed.data.name,
                url: `${serverURL}${parsed.data.url}`,
                type: parsed.data.type,
              },
              timestamp,
              seen_by: parsed.seen_by || [],
              id: i,
              replyTo: parsed.replyTo || null,
            };
            updateMessages.push(msg);
          }
        } catch (e) {
          console.error("Error parsing client audio:", e);
        }
      }
    }
    updateMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setClientUpdateMessages(updateMessages);
  }, [projectDetails]);
  // Combine chats and updates
  useEffect(() => {
    const combined = [...chatMessages, ...clientUpdateMessages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setCombinedMessages(combined);
  }, [chatMessages, clientUpdateMessages]);
  console.log("Project Detailsssss", projectDetails);
  // Handle window resize
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // Intersection observer for marking messages as seen
  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const idx = target.dataset.idx;
            if (idx) {
              const msg = combinedMessages[parseInt(idx)]; // Use combined
              const viewer = "monitor";
              if (msg && msg.isLeft && !msg.fromClient && !msg.seen_by.includes(viewer) && msg.id !== undefined) { // Skip if fromClient
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
  }, [combinedMessages, projectDetails?.project_id]); // Use combined
  useEffect(() => {
  const currentObserver = observer.current;
  if (currentObserver) {
    currentObserver.disconnect();
    combinedMessages.forEach((msg, idx) => { // Use combined
      if (msg.isLeft && !msg.fromClient) { // Skip observer for client messages
        const el = messageRefs.current[`${idx}`];
        if (el instanceof HTMLElement) {
          el.dataset.idx = idx.toString();
          currentObserver.observe(el);
        }
      }
    });
  }
}, [combinedMessages]); // Use combined
  // Auto-scroll chat container
  useEffect(() => {
    if (chatContainerRef.current) {
      if (autoScrollRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        setShowScrollToBottom(false); // Hide icon on auto-scroll
      }
    }
    if (combinedMessages.length > prevMessagesLengthRef.current) { // Use combined
      autoScrollRef.current = true;
      prevMessagesLengthRef.current = combinedMessages.length;
    }
  }, [combinedMessages, sending]); // Use combined
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
}, [combinedMessages]); // Use combined // Add chatMessages to deps for re-check after new msgs
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      setShowScrollToBottom(false); // Hide icon after scroll
    }
  };
  // Handle outside clicks for message controls
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
  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;
  const requiresPreview = (msg: ChatMessage) => {
    if (msg.type === "text") return false;
    if (!msg.file?.type) return false;
    const ft = msg.file.type;
    if (ft.startsWith("audio/") || ft.startsWith("video/")) return false;
    return true;
  };
  const markMessageAsSeen = (msg: ChatMessage) => {
    if (msg.fromClient) return; // Skip marking for client messages
    if (!projectDetails?.project_id || msg.id === undefined || !socket) return;
    const messageType = msg.type === "file" && msg.file?.type.startsWith("audio/") ? "audio" : "chat";
    const fromTL = msg.fromTL;
    const viewer = "monitor";
    socket.emit("markTLMonitorSeen", {
      projectId: projectDetails.project_id,
      index: msg.id,
      fromTL,
      type: messageType,
      viewer,
      timestamp: msg.timestamp // Pass timestamp for emit
    });
    // Optimistic update
    setChatMessages((prev) =>
      prev.map((m) =>
        (m.timestamp === msg.timestamp && m.fromTL === fromTL)
          ? { ...m, seen_by: [...new Set([...m.seen_by, viewer])] }
          : m
      )
    );
    // Also update combined
    setCombinedMessages((prev) =>
      prev.map((m) =>
        (m.timestamp === msg.timestamp && m.fromTL === fromTL)
          ? { ...m, seen_by: [...new Set([...m.seen_by, viewer])] }
          : m
      )
    );
  };
  const isSeenByReceiver = (msg: ChatMessage) => {
    if (msg.fromClient) return false; // No checkmark for client messages
    // For sent messages (!msg.isLeft, from Employee/Monitor/Solo): seen by TL
    if (!msg.isLeft) {
      return msg.seen_by.includes("tl");
    }
    // For received messages (msg.isLeft, from TL): no checkmark shown on employee's side
    return false;
  };
  // Update getSeenText to include names and designations
  const getSeenText = (msg: ChatMessage) => {
    if (msg.fromClient) return ""; // Skip for client messages
    if (msg.seen_by.length === 0) return "Not seen yet";
    let text = "";
    const tlName = tlMonitorChats?.teamleadername;
    const monitorName = tlMonitorChats?.monitorname || employeeData.employeeName;
    if (msg.seen_by.includes("tl")) {
      text += `Team Leader (${tlName})`;
    }
    if (msg.seen_by.includes("monitor")) {
      if (text) text += ", ";
      text += `Monitor (${monitorName})`;
    }
    return `Seen by ${text}`;
  };
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Invalid Date";
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-GB");
  };
  const handleRequest = async () => {
    if (requestStatus) return;
    try {
      setIsRequesting(true);
      if (!item.project_id || isNaN(Number(item.project_id))) {
        setError("Invalid project ID. Please select a valid project.");
        setAnimate(true);
        setTimeout(() => setAnimate(false), 1000);
        return;
      }
      if (!employeeData || !employeeData.employeeId) {
        setError("Employee data not found. Please log in.");
        setAnimate(true);
        setTimeout(() => setAnimate(false), 1000);
        return;
      }
      const requestData = {
        project_id: Number(item.project_id),
        employeeId: employeeData.employeeId,
        status: "pending",
      };
      const response = await postData("clientproject/submit_request", requestData);
      if (response.status) {
        setSuccess("Request sent successfully!");
        setAnimate(true);
        setRequestStatus("pending");
        setTimeout(() => {
          setAnimate(false);
          setSuccess("");
        }, 1000);
      } else {
        setError(`Failed to send request: ${response.message || "Unknown error"}`);
        setAnimate(true);
        setTimeout(() => setAnimate(false), 1000);
      }
    } catch (error: any) {
      console.error("Error submitting request:", error);
      setError(`Error: ${error.message || "Failed to submit request. Please try again."}`);
      setAnimate(true);
      setTimeout(() => setAnimate(false), 1000);
    } finally {
      setIsRequesting(false);
    }
  };
  const handleSendMessage = async (
    message: string,
    type: "text" | "voice" | "file" = "text",
    files?: { name: string; url: string; type: string; blob?: Blob }[]
  ) => {
    if (!socket || !connected || !projectDetails?.project_id) return;
    setSending(true);
    try {
      const projId = projectDetails.project_id;
      const timestamp = new Date().toISOString();
      const senderId = employeeData?.employeeId || "default_id";
      const tempId = uuidv4();
      if (type === "text" && message.trim()) {
        const optimisticMsg: ChatMessage = {
          message,
          isLeft: false,
          fromTL: false,
          type: "text",
          timestamp,
          seen_by: [],
          tempId,
          replyTo: replyToMessage || null, // NEW
          // ✅ ADD THESE 3 LINES
  senderId: employeeData.employeeId,
  senderName: employeeData.employeeName,
  senderPic: employeeData.employeePic,
        };
        setChatMessages((prev) => [...prev, optimisticMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
        socket.emit("sendEmployeeMessage", {
          projectId: projId,
          type: "text",
          msgData: message,
          timestamp,
          senderId,
          senderName: employeeData.employeeName, 
          tempId,
          replyTo: replyToMessage || null,
        });
        setNewMessage("");
      } else if (type === "voice" && files && files[0]?.blob) {
        const file = files[0];
        const formData = new FormData();
        formData.append("file", file.blob!, file.name);
        formData.append("projectId", projId);
        const uploadResponse = await postData(`clientproject/upload_file`, formData);
        if (uploadResponse.status) {
          const url = uploadResponse.data?.fileUrl || "";
          if (url) {
            const optimisticMsg: ChatMessage = {
              file: { name: file.name, url: `${serverURL}${url}`, type: file.type || "audio/mp3" },
              isLeft: false,
              fromTL: false,
              type: "file",
              timestamp,
              seen_by: [],
              tempId,
              replyTo: replyToMessage || null,
              // ✅ ADD THESE 3 LINES
  senderId: employeeData.employeeId,
  senderName: employeeData.employeeName,
  senderPic: employeeData.employeePic,
            };
            setChatMessages((prev) => [...prev, optimisticMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
            socket.emit("sendEmployeeMessage", {
              projectId: projId,
              type: "audio",
              msgData: { name: file.name, url, type: file.type || "audio/mp3" },
              timestamp,
              senderId,
              senderName: employeeData.employeeName,
              senderPic: employeeData.employeePic,
              tempId,
              replyTo: replyToMessage || null,
            });
          }
        }
      } else if (type === "file" && files && files.length > 0) {
        for (const file of files) {
          if (file.blob) {
            const formData = new FormData();
            formData.append("file", file.blob, file.name);
            formData.append("projectId", projId);
            const uploadResponse = await postData(`clientproject/upload_file`, formData);
            if (uploadResponse.status) {
              const url = uploadResponse.data?.fileUrl || "";
              if (url) {
                const optimisticMsg: ChatMessage = {
                  file: { name: file.name, url: `${serverURL}${url}`, type: file.type },
                  isLeft: false,
                  fromTL: false,
                  type: "file",
                  timestamp,
                  seen_by: [],
                  tempId,
                  replyTo: replyToMessage || null,
                  // ✅ ADD THESE 3 LINES
  senderId: employeeData.employeeId,
  senderName: employeeData.employeeName,
  senderPic: employeeData.employeePic,
                };
                setChatMessages((prev) => [...prev, optimisticMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
                socket.emit("sendEmployeeMessage", {
                  projectId: projId,
                  type: "file",
                  msgData: { name: file.name, url, type: file.type },
                  timestamp,
                  senderId,
                  tempId,
                  replyTo: replyToMessage || null,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
      setReplyToMessage(null);
    }
  };
  const getReadableFileType = (type?: string) => {
    if (!type) return "FILE";
    if (type === "application/pdf") return "PDF";
    if (
      type === "application/msword" ||
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
      return "DOC";
    if (type === "application/zip") return "ZIP";
    if (type.startsWith("audio/")) return "AUDIO";
    if (type.startsWith("video/")) return "VIDEO";
    if (type.startsWith("image/")) return "IMAGE";
    return "FILE";
  };
  const handleDownloadFile = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };
  const handleOpenPreview = (file: File | undefined, msg: ChatMessage) => {
    if (file) {
      setSelectedFile(file);
      setIsModalOpen(true);
      const isReceived = msg.isLeft;
      const viewer = "monitor";
      if (isReceived && !msg.fromClient && !msg.seen_by.includes(viewer) && msg.id !== undefined) {
        markMessageAsSeen(msg);
      }
    }
  };
  const renderPreview = (file: File) => {
    const { type, url, name } = file;
    if (type.startsWith("image/")) {
      return <img src={url} alt={name} className="max-w-full max-h-[80vh] object-contain" />;
    } else if (type.startsWith("video/")) {
      return <video controls src={url} className="max-w-full max-h-[80vh]" />;
    } else if (type.startsWith("audio/")) {
      return <audio controls src={url} className="w-full" />;
    } else if (type === "text/html") {
      return <iframe src={url} title={name} className="w-full h-[80vh] border-none" />;
    } else if (type === "application/pdf") {
      return <iframe src={url} title={name} className="w-full h-[80vh] border-none" />;
    } else if (type === "application/msword" || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return <iframe src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`} title={name} className="w-full h-[80vh] border-none" />;
    } else if (type === "application/zip") {
      return <p className="text-gray-600 italic">Preview not available for ZIP files. Please download to view.</p>;
    }
    return <p className="text-gray-600 italic">Preview not available for this file type. Please download to view.</p>;
  };

const getSenderInfo = (msg: ChatMessage) => {
  const myId = String(employeeData?.employeeId || "");

  if (msg.fromClient) {
    return { name: projectDetails?.clientName || "Client", role: "CLIENT" };
  }

  // Self detection
  if (msg.senderId && String(msg.senderId) === myId) {
    return { name: "YOU", role: "EMPLOYEE" };
  }

  // 🔥 REAL NAME (Nihal, Varun, Vishwa etc.)
  if (msg.senderName && msg.senderName.trim() !== "") {
    return { 
      name: msg.senderName, 
      role: msg.fromTL ? "TEAM LEADER" : "EMPLOYEE" 
    };
  }

  return { 
    name: msg.fromTL ? "Team Leader" : "Employee", 
    role: msg.fromTL ? "TEAM LEADER" : "EMPLOYEE" 
  };
};

  const buttonValue = isRequesting
    ? "Requesting..."
    : requestStatus
    ? requestStatus.charAt(0).toUpperCase() + requestStatus.slice(1)
    : "Request";

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
    processUpdates(clientUpdateMessages);
    setIsUpdatesLoading(false);
  }, [clientUpdateMessages]);
  const highlightUpdate = (updateItem: UpdateItem) => {
    const msg = combinedMessages.find(
      (m) => m.timestamp === updateItem.messageTimestamp && m.fromClient
    );
    if (msg) {
      const currentIndex = combinedMessages.indexOf(msg);
      const el = messageRefs.current[`${currentIndex}`];
      if (el) {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
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
    <div>
      <MainNavigation isMenuHide={false} />
      {success && (
        <div
          className={`text-white flex gap-x-2 text-[14px] absolute px-10 py-4 font-semibold bg-[#0cd621] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#7afc88] to-[#7afc88] transition-[background-size] duration-1000 ease-out ${
            animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"
          }`}
        >
          <FaInfoCircle size={20} />
          {success}
        </div>
      )}
      {error && (
        <div
          className={`text-white flex gap-x-2 text-[14px] absolute px-10 py-4 font-semibold bg-[#f13c28] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#fca17a] to-[#fc9f7a] transition-[background-size] duration-1000 ease-out ${
            animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"
          }`}
        >
          <FaInfoCircle size={20} />
          {error}
        </div>
      )}
      <div
        className={`flex flex-col text-[12px] text-start w-full -tracking-[0.02rem] text-black ${
          isLG
            ? "px-16 py-20 overflow-y-auto min-h-screen justify-center"
            : isXL || is2XL
            ? "px-24 min-h-screen overflow-y-auto py-20 justify-center"
            : "px-4 py-15"
        } items-start space-y-6`}
      >
        
        {/* */}
        <div className={`w-full gap-x-15 ${isXXS || isXS || isSM || isMD? "flex-col" : "flex-row space-x-4"} flex `}>
          <div className={`${isXXS || isXS || isSM || isMD ? "w-full" : "w-[50%]"}`}>
            <div
          className={`w-full ${isXXS || isXS || isSM ? "space-y-4" : "flex"} justify-between`}
        >
          <Button1 value={projectDetails?.workstream || "N/A"} gradientType="gradient1" />
          
        </div>
        <div className="flex justify-between items-center">
        <div className="flex my-5">
          <div>Project ID:</div>
          <div className="font-semibold">{projectDetails?.project_id || "N/A"}</div>
        </div>
        <div>
            Deadline: {projectDetails?.deadline ? new Date(projectDetails.deadline).toLocaleDateString() : "N/A"}
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
              </div>
            </div>
            <div className="w-fit my-5">
              <Button2
              value={buttonValue}
              onClick={handleRequest}
              disabled={!!requestStatus || isCompleted}
              loading={isRequesting}
            />
            </div>
            </div>
            {showChat ? (
  <div className={`w-[50%] md:min-h-[400px] min-h-[300px] md:max-h-[650px] max-h-[550px] flex flex-col items-center justify-between pb-4
      ${isCompleted || isChatDisabled ? 'bg-[#dddddd]' : 'bg-gradient-to-t from-[#f0f9fd] to-[#CFE3FF]'}
      ring-1 ring-inset ring-cyan-100/50 text-slate-500 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)] shadow-[#8A8A8A] rounded-[10px]`}>
      <div className="w-full relative items-center md:h-[600px] h-[500px] md:max-h-[600px] max-h-[500px] justify-start flex flex-col">
        <div
          className="flex items-center w-fit rounded-md justify-center text-white"
          style={{
   background: isChatDisabled
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
    let displayedMessages: ChatMessage[] = [];
    if (currentTab === "chat") {
      displayedMessages = combinedMessages;
    } else if (currentTab === "files") {
      displayedMessages = combinedMessages.filter((msg) => msg.type === "file");
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
              </div>
              <div
                className={`${
                  msg.isLeft
                    ? `${isSM || isXS || isXXS ? "pr-0" : " "}`
                    : `${isSM || isXS || isXXS ? "" : ""}`
                } relative p-1 text-start w-fit `}
              >
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
  className={`backdrop-blur-xl sm:w-fit sm:max-w-[250px] md:w-fit md:max-w-[180px] lg:w-fit lg:max-w-[220px] w-fit max-w-[180px] ${
    msg.isLeft
      ? "bg-white "
      : "bg-[#fffddc] border-r-yellow-600/30 border-r-[3px]"
  } shadow-[0_4px_20px_-4px_rgba(100,116,139,0.12)] p-3 rounded-2xl ${
    msg.isLeft
      ? "rounded-tl-none border-l-blue-600/30 border-l-[3px]"
      : "rounded-br-none"
  } transition-all duration-200 ease-out`}
>
  {msg.replyTo && (
    <div
      onClick={() => handleClickOnReplyBubble(msg.replyTo!)}
      className="mb-2 p-2 bg-[#ececec] rounded-md border-l-4 border-blue-500 cursor-pointer hover:bg-gray-200 transition"
    >
      <div className="text-xs font-medium text-gray-600">
        {msg.replyTo.sender}
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
    <>
      {msg.message && msg.type === "text" && (
        <div
          className="text-gray-900 leading-snug break-words hyphens-auto"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              highlightMessageText(msg.message)
            ),
          }}
        />
      )}

      {msg.file &&
        msg.file.url &&
        msg.file.name && (
          <div
            ref={index === msgControl ? divRef : null}
            onClick={() =>
              setMsgControl(msgControl === index ? null : index)
            }
            className="
              group relative mt-1 h-fit shadow-sm shadow-amber-200 max-w-[300px] cursor-pointer overflow-hidden
              rounded-xl border border-slate-200 bg-white
              transition-all duration-300 ease-out
              hover:border-slate-400 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]
              active:scale-[0.985]
            "
          >
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

            {(() => {
              const fileType = msg.file.type;
              const url = msg.file.url;
              const name = msg.file.name;
              if (fileType.startsWith("audio/")) {
                return (
                  <div className="px-3 py-2 border-t border-gray-200">
                    <audio controls src={url} className="min-w-[150px] max-w-full" />
                  </div>
                );
              } else if (fileType.startsWith("image/")) {
                return (
                  <div
                    className="px-0 pb-2 relative border-t border-gray-200 h-[100px] flex items-center justify-center"
                  >
                    <img
                      src={url}
                      alt={name}
                      className="max-h-full max-w-full object-contain"
                    />
                    {msgControl === index && (
                      <ActionBar msg={msg} index={index} url={url} name={name}/>
                    )}
                  </div>
                );
              } else if (fileType.startsWith("video/")) {
                return (
                  <div className="px-0 py-0 border-t border-gray-200">
                    <video controls src={url} className="w-full max-h-[100px] object-contain" />
                  </div>
                );
              } else if (
                ["text/html", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"].includes(fileType)
              ) {
                return (
                  <div className="px-3 flex items-center justify-center">
                    {msgControl === index && (
                      <ActionBar msg={msg} index={index} url={url} name={name}/>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
    </>
  )}

  <div
    className={`text-xs text-gray-500 mt-1 ${
      msg.isLeft ? "text-left" : "text-right"
    }`}
  >
    {msg.edited && !msg.isDeleted && (
      <span className="text-[10px] text-amber-500 mr-1 italic">edited</span>
    )}
    {new Date(msg.timestamp).toLocaleTimeString("en-IN")}
    {!msg.isLeft && (
      <span className="inline-flex items-center ml-1">
        <IoCheckmarkDoneSharp
          size={14}
          color={isSeenByReceiver(msg) ? "#00B7FF" : "#000000"}
          className="inline-block"
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
              onClick={(e) => {
                e.stopPropagation();
                handleEditMessage(msg);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
            >
              <MdEdit size={15} className="text-blue-500" /> Edit
            </div>
          )}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteMessage(msg);
            }}
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
  {sending && (
    <div className="flex justify-end my-2">
      <div className="flex items-center flex-row-reverse">
        <div className="w-8 h-8 ml-2 shrink-0 rounded-full flex items-center justify-center">
          <img
            src={`${serverURL}/files/${employeeData.employeePic}`}
            alt="Profile"
            className="w-10 h-8 rounded-full border-2 border-blue-500/50"
            onError={(e) => {
              e.currentTarget.src = UserIcon;
            }}
          />
        </div>
        <div
          className={`${
            isSM || isXS || isXXS ? "pr-0 max-w-[220px] min-w-[80%]" : "pr-12 max-w-[300px] min-w-[50%]"
          } text-start py-2 rounded-lg bg-white p-3 pr-4 shadow-sm relative break-words flex justify-center items-center`}
        >
          <div className="flex space-x-1">
            <span
              className="h-2 w-2 bg-blue-500 rounded-full"
              style={{
                animation: "bounceDot 0.6s infinite ease-in-out",
                animationDelay: "0s",
              }}
            ></span>
            <span
              className="h-2 w-2 bg-blue-500 rounded-full"
              style={{
                animation: "bounceDot 0.6s infinite ease-in-out",
                animationDelay: "0.2s",
              }}
            ></span>
            <span
              className="h-2 w-2 bg-blue-500 rounded-full"
              style={{
                animation: "bounceDot 0.6s infinite ease-in-out",
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
</div>
                </div>
                <div className="w-[90%]">
                <MikeSearch
  value={newMessage}
  onChange={(e) => setNewMessage(e.target.value)}
  onSend={(message, type, files) => {
    if (editingMessage) {
      sendEditedMessage();
    } else {
      handleSendMessage(message, type, files);
    }
  }}
  disabled={!showChat || isChatDisabled}
  placeholder={editingMessage ? "Edit your message..." : "Type your message..."}
  onPreviewHeightChange={setPreviewHeight}
  inputRef={inputRef}
  replyTo={replyToMessage}
  onCancelReply={() => setReplyToMessage(null)}
  projectId={projectDetails?.project_id}
/>
              </div>
              </div>
            ) : (
              <div className="w-full text-[14px] text-center py-8 text-gray-500">
                Chat not available for this role/assignment.
              </div>
            )}
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
{showTimeLimitPopup && (
  <div className="fixed bottom-[85px] left-1/2 -translate-x-1/2 z-[60]">
    <div className="bg-gray-900/95 text-white text-[11px] font-medium px-4 py-1.5 rounded-full shadow-lg">
      ⏰ You can only edit/delete within 2 minutes
    </div>
  </div>
)}
    </div>
  );
};
export default EmployeeProjectInfo;