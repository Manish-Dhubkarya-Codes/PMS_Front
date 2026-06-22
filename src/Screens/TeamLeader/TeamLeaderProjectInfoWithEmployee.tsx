import React, { useEffect, useRef, useState } from "react";
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
import { useLocation } from "react-router-dom";
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
import useSound from "use-sound";
import notificationSound from "../../assets/CredientialAssets/Chat_Notification_Sound.mp3";
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from "../../BackendConnections/useSocket";
import { Commet } from "react-loading-indicators";
import { MdOutlineDoubleArrow, MdOutlineReply } from "react-icons/md";
import ProgressTracking from "../../UI_Components/Progresses/ProgressTracking";

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
  replyTo?: ReplyMessage | null; // NEW: Added for reply context
  senderName?: string;   // ← NEW
  senderPic?: string;
  senderId?: string;
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
  const [playNotification] = useSound(notificationSound);
  const location = useLocation();
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
const toggleFileSelect = (timestamp: string) => {
  setSelectedFileTimestamps((prev) => {
    const next = new Set(prev);
    next.has(timestamp) ? next.delete(timestamp) : next.add(timestamp);
    return next;
  });
};
const isCompleted = projectDetails?.status === "Completed";
const forwardFiles = async (timestamps: string[]) => {
  if (!projectDetails?.project_id || !parsedData?.employeeId) return;

  const projId = projectDetails.project_id;
  const teamleaderid = parsedData.employeeId;

  for (const ts of timestamps) {
    const msg = chatMessages.find((m) => m.timestamp === ts && m.type === "file" && m.file);
    if (!msg?.file) continue;

    const msgData = {
      name: msg.file.name,
      url: getRelativeUrl(msg.file.url),
      type: msg.file.type,
    };

    try {
      await postData(`clientproject/add_tl_chat/${projId}`, {
        type: "file",
        data: msgData,          // ← This is correct
        timestamp: new Date().toISOString(),
        teamleaderid,
      });
    } catch (err) {
      console.error("Forward failed for", msg.file.name, err);
    }
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

  const fetchTlMonitorChats = async () => {
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
  };

  useEffect(() => {
    if (item?.project_id) {
      fetchProject();
      fetchTlMonitorChats();
    } else {
      setProjectDetails(item);
    }
  }, [item]);

  useEffect(() => {
    if (socket && connected && projectDetails?.project_id) {
      socket.emit("joinEmployeeChat", projectDetails.project_id);
      socket.emit("joinProject", projectDetails.project_id); // Join main project room for updates
    }
  }, [socket, connected, projectDetails?.project_id]);

useEffect(() => {
  if (!socket) return;

  const handler = (data: { fromRole: string; msg: any }) => {
    console.log("🔥 SOCKET FULL DATA:", data);
    console.log("🔥 INCOMING MSG:", data.msg);
    console.log("🔥 SENDER NAME:", data.msg?.senderName);

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
          tempId: incoming.tempId,
        };
        return updated.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      } else {
        const fromTL = fromRole === "tl";
        const viewerRole = storedUserRole === "Team Leader" ? "tl" : "monitor";
        const isLeft = fromRole !== viewerRole;

        const newMsg: ChatMessage = {
          type: incoming.type === "text" ? "text" : "file",
          isLeft,
          fromTL,
          timestamp: incoming.timestamp,
          seen_by: incoming.seen_by || [],
          id: incoming.id,
          replyTo: incoming.replyTo || null,
          senderName: incoming.senderName,
          senderPic: incoming.senderPic,
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

        return [...prev, newMsg].sort((a, b) =>
          a.timestamp.localeCompare(b.timestamp)
        );
      }
    });

    playNotification();
  };

  socket.on("newTLMonitorMessage", handler);

  return () => {
    socket.off("newTLMonitorMessage", handler);
  };
}, [socket, storedUserRole]);

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
                storedUserRole === "Team Leader" ? "tl" : "monitor";
              if (
                msg &&
                msg.isLeft &&
                !msg.fromClient && // Skip marking for client updates
                !msg.seen_by.includes(viewer) &&
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
  useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      fetchTlMonitorChats(); // Or fetchProject(true);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [fetchTlMonitorChats]);

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
    const viewer = storedUserRole === "Team Leader" ? "tl" : "monitor";
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
    const receiver = storedUserRole === "Team Leader" ? "monitor" : "tl"; // Fixed: dynamic receiver
    return msg.seen_by.includes(receiver);
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
    const receiverRole = "Monitor"; // Or "Employee" if you want to detect solo, but using "Monitor" for receiver
    if (msg.seen_by.includes("tl")) {
      text += `Team Leader (${tlName})`;
    }
    if (msg.seen_by.includes("monitor")) {
      if (text) text += ", ";
      text += `${receiverRole} (${receiverName})`;
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
  files?: { name: string; url: string; type: string; blob?: Blob }[]
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
              tempId,
              replyTo: replyToMessage || null,
            });
          }
        }
      } 
      else if (type === "file" && files && files.length > 0) {
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
                  file: {
                    name: file.name,
                    url: `${serverURL}${url}`,
                    type: file.type,
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
      setLoading(false);
      setReplyToMessage(null);
      fetchTlMonitorChats();
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
      const viewer = storedUserRole === "Team Leader" ? "tl" : "monitor";
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

useEffect(() => {
  if (!tlMonitorChats || !projectDetails) return;

  let allMessages: ChatMessage[] = [];

  const maxLengthTL = Math.max(
    tlMonitorChats.tlchats?.length || 0,
    tlMonitorChats.tlaudios?.length || 0
  );
  const maxLengthMonitor = Math.max(
    tlMonitorChats.monitorchats?.length || 0,
    tlMonitorChats.monitoraudios?.length || 0
  );
  const maxLength = Math.max(maxLengthTL, maxLengthMonitor);

  for (let i = 0; i < maxLength; i++) {
    // ====================== TL MESSAGES ======================
    if (i < (tlMonitorChats.tlchats?.length || 0)) {
      const chatStr = tlMonitorChats.tlchats?.[i];
      if (typeof chatStr === "string") {
        try {
          const parsed = JSON.parse(chatStr);
          let timestamp = parsed.timestamp;
          if (!timestamp || isNaN(new Date(timestamp).getTime())) {
            timestamp = new Date().toISOString();
          }

          const msg: ChatMessage = {
            type: parsed.type === "text" ? "text" : "file",
            isLeft: storedUserRole !== "Team Leader",
            fromTL: true,
            timestamp,
            seen_by: parsed.seen_by || [],
            id: i,
            replyTo: parsed.replyTo || null,
            senderId: parsed.senderId || tlMonitorChats?.teamleaderid?.toString() || parsedData?.employeeId?.toString() || "",
senderName: parsed.senderName || tlMonitorChats?.teamleadername,
senderPic: parsed.senderPic || tlMonitorChats?.teamleaderpic || "",
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
          console.error("Error parsing TL chat:", e);
        }
      }
    }

    // ====================== TL AUDIOS ======================
    if (tlMonitorChats.tlaudios && i < tlMonitorChats.tlaudios.length) {
      const audioStr = tlMonitorChats.tlaudios[i];
      try {
        const parsed = JSON.parse(audioStr);
        let timestamp = parsed.timestamp;
        if (!timestamp || isNaN(new Date(timestamp).getTime())) {
          timestamp = new Date().toISOString();
        }

        const msg: ChatMessage = {
          type: "file",
          isLeft: storedUserRole !== "Team Leader",
          fromTL: true,
          file: {
            name: parsed.data.name,
            url: `${serverURL}${parsed.data.url}`,
            type: parsed.data.type,
          },
          timestamp,
          seen_by: parsed.seen_by || [],
          id: i,
          replyTo: parsed.replyTo || null,
          senderId: parsed.senderId || tlMonitorChats?.teamleaderid?.toString() || parsedData?.employeeId?.toString() || "",
senderName: parsed.senderName || tlMonitorChats?.teamleadername,
senderPic: parsed.senderPic || tlMonitorChats?.teamleaderpic || "",
        };

        allMessages.push(msg);
      } catch (e) {
        console.error("Error parsing TL audio:", e);
      }
    }

if (tlMonitorChats.monitorchats && i < tlMonitorChats.monitorchats.length) {
  const chatStr = tlMonitorChats.monitorchats[i];
  try {
    const parsed = JSON.parse(chatStr);
    let timestamp = parsed.timestamp || new Date().toISOString();
    
    console.log("🔥 TL - PARSED MONITOR CHAT SENDER NAME:", parsed.senderName);

    const msg: ChatMessage = {
      type: parsed.type === "text" ? "text" : "file",
      isLeft: storedUserRole === "Team Leader",
      fromTL: false,
      timestamp,
      seen_by: parsed.seen_by || [],
      id: i,
      replyTo: parsed.replyTo || null,
      senderName: parsed.senderName || tlMonitorChats?.monitorname || "Employee",
      senderId: parsed.senderId || tlMonitorChats?.monitorid?.toString() || "",
      senderPic: parsed.senderPic || "",
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
    console.error("Error parsing Monitor chat:", e);
  }
}

    // ====================== MONITOR AUDIOS (STRICT) ======================
    if (tlMonitorChats.monitoraudios && i < tlMonitorChats.monitoraudios.length) {
      const audioStr = tlMonitorChats.monitoraudios[i];
      try {
        const parsed = JSON.parse(audioStr);
        let timestamp = parsed.timestamp || new Date().toISOString();

        const msg: ChatMessage = {
          type: "file",
          isLeft: storedUserRole === "Team Leader",
          fromTL: false,
          file: {
            name: parsed.data.name,
            url: `${serverURL}${parsed.data.url}`,
            type: parsed.data.type,
          },
          timestamp,
          seen_by: parsed.seen_by || [],
          id: i,
          replyTo: parsed.replyTo || null,

         senderName: parsed.senderName || tlMonitorChats?.monitorname || "Employee",
      senderId: parsed.senderId || tlMonitorChats?.monitorid?.toString() || "",
      senderPic: parsed.senderPic || "",
        };

        allMessages.push(msg);
      } catch (e) {
        console.error("Error parsing Monitor audio:", e);
      }
    }
  }

  // ====================== CLIENT UPDATES (UNCHANGED) ======================
  let updateMessages: ChatMessage[] = [];

  if (projectDetails?.clientchats) {
    projectDetails.clientchats.forEach((chatStr, i) => {
      if (typeof chatStr === "string") {
        try {
          const parsed = JSON.parse(chatStr);
          const isUpdate =
            (parsed.type === "text" &&
              parsed.data.startsWith("@update_")) ||
            (parsed.type === "file" &&
              parsed.data.name?.startsWith("@update_"));

          if (isUpdate) {
            let timestamp = parsed.timestamp;
            if (!timestamp || isNaN(new Date(timestamp).getTime())) {
              timestamp = new Date().toISOString();
            }

            const msg: ChatMessage = {
              type: parsed.type === "text" ? "text" : "file",
              isLeft: true,
              fromTL: false,
              fromClient: true,
              timestamp,
              seen_by: [],
              id: `client_${i}`,
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
          console.error("Error parsing client chat for updates:", e);
        }
      }
    });
  }

  if (projectDetails?.clientaudios) {
    projectDetails.clientaudios.forEach((audioStr, i) => {
      if (typeof audioStr === "string") {
        try {
          const parsed = JSON.parse(audioStr);
          const isUpdate = parsed.data.name?.startsWith("@update_");

          if (isUpdate) {
            let timestamp = parsed.timestamp;
            if (!timestamp || isNaN(new Date(timestamp).getTime())) {
              timestamp = new Date().toISOString();
            }

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
              seen_by: [],
              id: `client_audio_${i}`,
            };

            updateMessages.push(msg);
          }
        } catch (e) {
          console.error("Error parsing client audio for updates:", e);
        }
      }
    });
  }

  allMessages = [...allMessages, ...updateMessages].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  setChatMessages(allMessages);
}, [tlMonitorChats, projectDetails, serverURL, storedUserRole]);

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

const getSenderInfo = (msg: ChatMessage) => {
  const myId = String(parsedData?.employeeId || "");

  if (msg.fromClient) {
    return { name: projectDetails?.clientName || "Client", role: "CLIENT" };
  }

  // Self detection
  if (msg.senderId && String(msg.senderId) === myId) {
    return { name: "YOU", role: "TEAM LEADER" };
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

  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  // const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;
const isChatDisabled = isCompleted;
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
                  <div className="flex justify-end ">
 <div className="flex items-center w-fit gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full transition-all duration-200 cursor-default">
  {/* Live Indicator Dot */}
  <span className="flex w-2 h-2 bg-emerald-500 rounded-full"></span>
  
  <p className="text-sm text-gray-600">
    Talking with <span className="font-semibold text-gray-900">Employee</span>
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
      className=" w-fit px-3 py-1 text-[12px] cursor-pointer bg-blue-600/90 text-white rounded-full mr-4 hover:bg-blue-700"
    >
      {isFileSelectionMode ? "Cancel" : <div className="flex items-center gap-x-2">Select Files <BiSolidSelectMultiple size={18}/></div>} 
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
      {/* ✅ FIXED: Proper reply sender display */}
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
                    {msg.message && msg.type === "text" && (
                     <div
          className="text-gray-900 leading-snug break-words hyphens-auto"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              highlightMessageText(
                msg.message,
              )
            ),
          }}
                    />)}
                    
                    {msg.file &&
                      msg.file.url &&
                      msg.file.name && (
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
                            ref={
                              index === msgControl
                                ? divRef
                                : null
                            }
                            onClick={() =>
                              setMsgControl(
                                msgControl === index
                                  ? null
                                  : index
                              )
                            }
className="
  group relative mt-1 h-fit shadow-sm shadow-amber-200 max-w-[300px] cursor-pointer overflow-hidden
  rounded-xl border border-slate-200 bg-white
  transition-all duration-300 ease-out
  hover:border-slate-400 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]
  active:scale-[0.985]
"                          >
                                                         {/* HEADER */}
                                                         <div className="flex items-center gap-3 px-3 py-2">
                                                           {(() => {
                                                             const fileType = msg.file.type;
                                                             let Icon = FaFileInvoice;
                                                             let color = "text-slate-600";
                             
                                                             if (fileType.startsWith("audio/")) {
                                                               Icon = FaFileAudio;
                                                               color = "text-orange-500";
                                                             } else if (
                                                               fileType.startsWith("image/")
                                                             ) {
                                                               Icon = FaFileImage;
                                                               color = "text-emerald-500";
                                                             } else if (
                                                               fileType.startsWith("video/")
                                                             ) {
                                                               Icon = FaFileVideo;
                                                               color = "text-violet-500";
                                                             } else if (
                                                               fileType === "application/pdf"
                                                             ) {
                                                               Icon = FaFilePdf;
                                                               color = "text-rose-500";
                                                             } else if (
                                                               fileType === "application/msword" ||
                                                               fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                                             ) {
                                                               Icon = FaFileWord;
                                                               color = "text-sky-600";
                                                             } else if (
                                                               fileType === "application/zip"
                                                             ) {
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
                                                               {getReadableFileType(
                                                                             msg.file.type
                                                               )} 
                                                             </p>
                                                           </div>
                                                         </div>
                              
                              {(() => {
                                const fileType = msg.file.type;
                                const url =
                                  msg.file.url.startsWith("blob:")
                                    ? msg.file.url
                                    : `${msg.file.url}`;
                                const name = msg.file.name;
                                if (
                                  fileType.startsWith("audio/")
                                ) {
                                  return (
                                    <div className="px-3 py-2 border-t border-gray-200">
                                      <audio
                                        controls
                                        src={url}
                                        className="min-w-[150px] max-w-full"
                                      />
                                    </div>
                                  );
                                } else if (
                                  fileType.startsWith("image/")
                                ) {
                                  return (
                                    <div
                                      ref={
                                        index === msgControl
                                          ? divRef
                                          : null
                                      }
                                      onClick={() =>
                                        setMsgControl(
                                          msgControl === index
                                            ? null
                                            : index
                                        )
                                      }
                                      className="px-0 pb-2 relative border-t border-gray-200 h-[100px] flex items-center justify-center"
                                    >
                                      <img
                                        src={url}
                                        alt={name}
                                        className="max-h-full max-w-full object-contain"
                                      />
                                      {msgControl === index && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                            <ActionBar
                              msg={msg}
                              index={index}
                              url={url}
                              name={name}
                            />
                          </div>
                                      )}
                                    </div>
                                  );
                                } else if (
                                  fileType.startsWith("video/")
                                ) {
                                  return (
                                    <div className="px-0 py-0 border-t border-gray-200">
                                      <video
                                        controls
                                        src={url}
                                        className="w-full max-h-[100px] object-contain"
                                      />
                                    </div>
                                  );
                                } else if (
                                  fileType === "text/html" ||
                                  fileType ===
                                    "application/pdf" ||
                                  fileType ===
                                    "application/msword" ||
                                  fileType ===
                                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                                  fileType === "application/zip"
                                ) {
                                  return (
                                    <div className="px-3  flex items-center justify-center">
                                      {msgControl === index && (
                                       <ActionBar
                              msg={msg}
                              index={index}
                              url={url}
                              name={name}
                            />
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        )}
                    <div
                      className={`text-xs text-gray-500 mt-1 ${
                        msg.isLeft
                          ? "text-left"
                          : "text-right"
                      }`}
                    >
                      {new Date(
                        msg.timestamp
                      ).toLocaleTimeString("en-IN")}
                      {!msg.isLeft && ( // Only on sent messages (right side, from TL)
                        <span className="inline-flex items-center ml-1">
                          <IoCheckmarkDoneSharp
                            size={14}
                            color={
                              isSeenByReceiver(msg)
                                ? "#00B7FF"
                                : "#000000"
                            }
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
                  </div>
                </div>
                {msg.isLeft && !isCompleted && ( // NEW: Add reply icon for left (received) messages
<div
onClick={() => handleReplyToMessage(msg)}
className="transition-all duration-200 cursor-pointer p-0.5 rounded-full bg-slate-50 border border-slate-300 flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] hover:bg-slate-800 hover:text-white hover:border-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(59,130,246,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-slate-500"
>
<MdOutlineReply size={15} />
</div>
)}
{!msg.isLeft && !isCompleted && ( // NEW: Add reply icon for right (sent) messages
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
                disabled={isChatDisabled}
  value={newMessage}
  onChange={(e) => setNewMessage(e.target.value)}
  onKeyDown={handleKeyDown}
  onSend={handleSendMessage}
  placeholder="Type your message..."
  onPreviewHeightChange={handlePreviewHeightChange}
  inputRef={inputRef}
  replyTo={replyToMessage} // NEW: Pass replyTo prop
  onCancelReply={() => setReplyToMessage(null)} // NEW: Pass cancel handler
  projectId={projectDetails?.project_id}
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