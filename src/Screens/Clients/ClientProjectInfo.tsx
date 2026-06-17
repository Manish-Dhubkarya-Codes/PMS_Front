import React, { useEffect, useRef, useState } from "react";
import { FiZoomIn, FiDownload, FiX } from "react-icons/fi";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FaBars, FaFileArchive, FaTimes, FaInfoCircle } from "react-icons/fa";
import { FaFilePdf, FaFileWord } from "react-icons/fa6";

import Button1 from "../../UI_Components/Buttons/Button1";
import Button3 from "../../UI_Components/Buttons/Button3";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import ProgressTracking from "../../UI_Components/Progresses/ProgressTracking";
import MikeSearch from "../../UI_Components/SearchBars/MikeSearch";
import UserIcon from "../../assets/CredientialAssets/UserLogo.png";
import QuillEditor from "../TextEditor";
import notificationSound from "../../assets/CredientialAssets/Chat_Notification_Sound.mp3";
import {
  getData,
  postData,
  serverURL,
} from "../../BackendConnections/FetchBackendServices";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { TbListDetails } from "react-icons/tb";
import { RiTimeLine } from "react-icons/ri";
import {
  FaFileInvoice,
  FaFileAudio,
  FaFileImage,
  FaFileVideo,
} from "react-icons/fa";
import DOMPurify from "dompurify";
import { IoCheckmarkDoneSharp } from "react-icons/io5";
import useSound from "use-sound";
import { v4 as uuidv4 } from "uuid";
import { useSocket } from "../../BackendConnections/useSocket";
import { useGlobalPush } from "../../hooks/useGlobalPush";
import { MdBlock, MdDelete, MdEdit, MdOutlineDoubleArrow, MdOutlineReply } from "react-icons/md";
import Button2 from "../../UI_Components/Buttons/Button2";
import { BsThreeDotsVertical } from "react-icons/bs";

interface ChatMessageProps {
  type: "text" | "file";
  isLeft: boolean;
  fromClient: boolean;
  fromHead: boolean;
  fromTeamLeader: boolean;
  message?: string;
  file?: { name: string; url: string; type: string; blob?: Blob };
  timestamp: string;
  seen_by: string[];
  id?: number;
  mention?: {
    type: "head" | "client" | "tl";
    id: string;
    name: string;
    imageUrl?: string;
  } | null;
  tempId?: string;
  replyTo?: ReplyMessage | null; // Added replyTo
  // New

  edited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  caption?: string;
  deletedAt?: string;
}

interface ClientProjectInfoProps {
  EmployeeName?: string;
  EmployeeDesignation?: string;
  ProjectTitle?: string;
  AboutCompany?: string;
  WhatDoYouNeed?: string;
  ChatMessages?: ChatMessageProps[];
  updateInfo?: UpdateItem;
}
interface SelectedFile {
  url: string;
  name: string;
  type: string;
}

interface MentionOption {
  label: string;
  value: string;
  type: "head" | "client" | "tl";
  id: string;
  name: string;
  imageUrl?: string;
}

interface UpdateItem {
  number: number;
  title: string;
  messageTimestamp: string;
  isText: boolean;
}

interface ReplyMessage {
  id: number;
  sender: string; // e.g., "Head", "Team Leader"
  content: string; // Truncated original message or file name
  type: "text" | "file";
  timestamp: string;
}

const ClientProjectInfo: React.FC<ClientProjectInfoProps> = () => {
  const [replyToMessage, setReplyToMessage] = useState<ReplyMessage | null>(
    null
  );
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [updates, setUpdates] = useState("");
  const [updatesList, setUpdatesList] = useState<UpdateItem[]>([]);
  const [updateTitle, setUpdateTitle] = useState<string>("");
  const [clientDescription, setClientDescription] = useState<string>("");
  const [initialDescription, setInitialDescription] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessageProps[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [isChatEnabled, setIsChatEnabled] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<
    { name: string; url: string; type: string; blob?: Blob }[]
  >([]);
  const [playNotification] = useSound(notificationSound, { volume: 1, preload: true });
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // const blobUrlsRef = useRef<Set<string>>(new Set());
  const [previewHeight, setPreviewHeight] = useState<number>(0);
  const [selectStream, setSelectStream] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [submissionDate, setSubmissionDate] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [isDateType, setIsDateType] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isProjectSubmitted, setIsProjectSubmitted] = useState<boolean>(false);
  const autoScrollRef = useRef<boolean>(true);
  const prevMessagesLengthRef = useRef(0);
  const location = useLocation();
  const [headPic, setHeadPicture] = useState<string>("");
  const [headName, setHeadName] = useState<string>("");
  const [headId, setHeadId] = useState<string>("");
  const [teamLeaderName, setTeamLeaderName] = useState<string>("");
  const [teamLeaderPic, setTeamLeaderPic] = useState<string>("");
  const { state } = location;
  const isAdd = state?.isAdd || false;
  const initialProjectDetails = state?.ProjectDetails || {};
  const hasProjectDetailsData = !isAdd && initialProjectDetails?.ProjectId;
  const [msgControl, setMsgControl] = useState<number | null>(null);
  const [update, setUpdate] = useState(false);
  const [currentTab, setCurrentTab] = useState<"chat" | "files">("chat");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isCompleted = initialProjectDetails?.status === "Completed";
  const [progress, setProgress] = useState({ start: 'no', payment: '0%', work: '0%' });
  // NEW: Edit / Delete states
  const [editingMessage, setEditingMessage] = useState<ChatMessageProps | null>(null);
  const [messageMenuIndex, setMessageMenuIndex] = useState<number | null>(null); // which message shows the 3-dot menu
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  let parsedData: any;
  const storedUserData = localStorage.getItem("userData");
  const storedUserRole = localStorage.getItem("role")
    ? atob(localStorage.getItem("role")!)
    : "";
  if (storedUserData) {
    try {
      parsedData = JSON.parse(atob(storedUserData));
    } catch (error) {
      console.warn("Error parsing userData:", error);
    }
  }

  const clientId = parsedData?.clientId || "";
  useGlobalPush(clientId, "client");
  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const observer = useRef<IntersectionObserver | null>(null);
  const { socket, connected, onEvent } = useSocket();
  const detectMention = (
    message: string
  ): ChatMessageProps["mention"] | null => {
    const lowerMessage = message.toLowerCase();
    const headNameTrimmed = (headName || "").trim().toLowerCase();
    if (lowerMessage.includes(`@${headNameTrimmed}`)) {
      return {
        type: "head",
        id: headId || "",
        name: headName || "",
      };
    }
    return null;
  };

  const localRole = "Client";

  const handleReplyToMessage = (msg: ChatMessageProps) => {
    const sender = msg.fromHead
      ? "Head"
      : msg.fromTeamLeader
        ? "Team Leader"
        : "Client";
    const content =
      msg.type === "text"
        ? msg.message?.substring(0, 50) +
        (msg.message && msg.message.length > 50 ? "..." : "")
        : msg.file?.name || "File";
    setReplyToMessage({
      id: msg.id ?? -1,
      sender,
      content,
      type: msg.type,
      timestamp: msg.timestamp,
    });
  };

  // NEW: Edit handler
  const handleEditMessage = (msg: ChatMessageProps) => {
    if (msg.type !== "text") return;
    setEditingMessage(msg);
    setNewMessage(msg.message || "");
    inputRef.current?.focus();
    setMessageMenuIndex(null); // close menu
  };

  const handleDeleteMessage = async (msg: ChatMessageProps) => {
    if (!projectId || !socket || !connected) return;
    setMessageMenuIndex(null);

    const timestamp = new Date().toISOString();

    // Optimistic update — match by timestamp
    setChatMessages((prev) =>
      prev.map((m) =>
        m.timestamp === msg.timestamp
          ? { ...m, isDeleted: true, deletedAt: timestamp, message: undefined, file: undefined }
          : m
      )
    );

    // ✅ FIX: use msg.id (real DB index), not the map() index from displayedMessages
    socket.emit("deleteClientMessage", {
      projectId,
      index: msg.id,
      timestamp,
    });
  };

  const sendEditedMessage = async () => {
    if (!editingMessage || !projectId || !socket || !connected) return;

    const timestamp = new Date().toISOString();

    setChatMessages((prev) =>
      prev.map((m) =>
        m.timestamp === editingMessage.timestamp
          ? { ...m, message: newMessage.trim(), edited: true, editedAt: timestamp }
          : m
      )
    );

    // ✅ FIX: always use editingMessage.id (real DB index)
    socket.emit("editClientMessage", {
      projectId,
      index: editingMessage.id,
      newText: newMessage.trim(),
      timestamp,
    });

    setEditingMessage(null);
    setNewMessage("");
  };



  // Added handleClickOnReplyBubble
  const handleClickOnReplyBubble = (reply: ReplyMessage) => {
    const repliedMsg = chatMessages.find(
      (m) => m.timestamp === reply.timestamp
    );
    if (repliedMsg) {
      const index = chatMessages.indexOf(repliedMsg);
      const el = messageRefs.current[`${index}`];
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
    const fetchHeadData = async () => {
      try {
        const headResponse = await getData("head/fetch_head_data");
        if (headResponse && headResponse.data) {
          setHeadId(headResponse.data.headId || "");
          setHeadName(headResponse.data.headName || "");
          setHeadPicture(headResponse.data.headPic || "");
        }
      } catch (error) {
        console.error("Error fetching head data:", error);
      }
    };
    fetchHeadData();
  }, []);
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "navigateToProject" && event.data.item) {
        const { ProjectId } = event.data.item;
        navigate(`/projectupload?projectId=${ProjectId}`, {
          state: { ProjectDetails: event.data.item, isAdd: false },
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          const projectId = searchParams.get("projectId");
          registration.active?.postMessage({
            type: "readyForProject",
            projectId,
          });
        })
        .catch((err) => console.error("SW ready error:", err));
    }
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      if (projectId) {
        try {
          const progressData = await getData(`clientproject/get_progress/${projectId}`);
          if (progressData.status) {
            setProgress(progressData.progress);
          }
        } catch (err) {
          console.error("Error fetching progress:", err);
        }
      }
    };
    fetchProgress();
  }, [projectId]);

  const handleMentionSelect = (option: MentionOption) => {
    if (inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      const before = newMessage.substring(0, cursorPos).replace(/@[^@]*$/, "");
      const after = newMessage.substring(cursorPos);
      const newValue = `${before}${option.value} ${after}`;
      setNewMessage(newValue);
      inputRef.current.focus();
      const newCursorPos = before.length + option.value.length + 1;
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
      const mentionMatch = before.match(/@([^\s@]+(?:\s+[^\s@]+)*)\s?$/);
      if (mentionMatch) {
        const mentionText = mentionMatch[0];
        const newBefore = before.substring(
          0,
          before.length - mentionText.length
        );
        const after = newMessage.substring(cursorPos);
        setNewMessage(`${newBefore}${after}`);
        e.preventDefault();
      }
    }
  };
  const mentionOptions: MentionOption[] = [
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
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };
  const highlightMessageText = (
    text: string,
    mention: ChatMessageProps["mention"]
  ) => {
    if (!text) return text;
    let highlighted = text;
    if (headName) {
      const headMentionStr = `@${headName}`;
      highlighted = highlighted.replace(
        new RegExp(escapeRegExp(headMentionStr), "gi"),
        `<span style="color: #2934E3; font-weight: 500;">${headMentionStr}</span>`
      );
    }
    if (teamLeaderName) {
      const tlMentionStr = `@${teamLeaderName}`;
      highlighted = highlighted.replace(
        new RegExp(escapeRegExp(tlMentionStr), "gi"),
        `<span style="color: #2934E3; font-weight: 500;">${tlMentionStr}</span>`
      );
    }
    highlighted = highlighted.replace(
      /@Team Leader/gi,
      '<span style="color: #2934E3; font-weight: 500;">@Team Leader</span>'
    );
    if (parsedData?.clientName) {
      const clientMentionStr = `@${parsedData.clientName}`;
      highlighted = highlighted.replace(
        new RegExp(escapeRegExp(clientMentionStr), "gi"),
        `<span style="color: #2934E3; font-weight: 500;">${clientMentionStr}</span>`
      );
    }
    if (mention) {
      const mentionStr = `@${mention.name}`;
      highlighted = highlighted.replace(
        new RegExp(escapeRegExp(mentionStr), "gi"),
        `<span style="color: #2934E3; font-weight: 500;">${mentionStr}</span>`
      );
    }
    highlighted = highlighted.replace(
      /(@update_[^:\n]+:)/g,
      '<span style="color: #4DD60B; font-weight: 500;">$1</span>'
    );
    return highlighted;
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
  const preloadImages = async (element: HTMLElement) => {
    const images = Array.from(element.querySelectorAll("img"));
    await Promise.all(
      images.map(async (img) => {
        if (img.src && !img.src.startsWith("data:")) {
          try {
            const response = await fetch(img.src, {
              mode: "cors",
              credentials: "include",
              cache: "no-cache",
            });
            if (!response.ok) throw new Error(`Failed to fetch ${img.src}`);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            img.src = dataUrl;
          } catch (err) {
            console.error(`Error preloading image ${img.src}:`, err);
          }
        }
      })
    );
  };

  const generatePdfBlob = async (
    htmlContent: string,
  ): Promise<Blob> => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.padding = "40px";
    tempDiv.style.background = "white";
    tempDiv.style.color = "black";
    tempDiv.style.fontFamily = "Arial, sans-serif";
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "0";
    tempDiv.style.width = "800px";
    document.body.appendChild(tempDiv);

    await preloadImages(tempDiv);

    const links: { rect: DOMRect; href: string }[] = [];
    const anchors = tempDiv.querySelectorAll("a");
    anchors.forEach((a) => {
      const rect = a.getBoundingClientRect();
      const href = a.href;
      if (href) {
        links.push({ rect, href });
      }
    });

    const scale = 2;
    const canvas = await html2canvas(tempDiv, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    // const pdfHeight = pdf.internal.pageSize.getHeight();
    // const imgWidth = (canvas.width / scale) * (72 / 96);
    const imgHeight = (canvas.height / scale) * (72 / 96);

    const marginX = 20;
    const marginY = 60;
    pdf.addImage(imgData, "PNG", marginX, marginY, pdfWidth - 40, imgHeight);

    links.forEach(({ rect, href }) => {
      const x =
        marginX +
        (rect.left - tempDiv.getBoundingClientRect().left) * (72 / 96);
      const y =
        marginY + (rect.top - tempDiv.getBoundingClientRect().top) * (72 / 96);
      const w = rect.width * (72 / 96);
      const h = rect.height * (72 / 96);

      pdf.link(x, y, w, h, { url: href });
    });

    document.body.removeChild(tempDiv);
    return pdf.output("blob");
  };

  const generateProjectDetailsPdf = async (data: {
    workstream: string;
    title: string;
    deadline: string;
    budget: string;
    description: string;
    projectId?: string;
  }): Promise<{ blob: Blob; fileName: string }> => {
    const cleanDescription = data.description || "<p>No description</p>";
    const html = `
  <div style="font-family: 'Helvetica', 'Arial', sans-serif; color: #1f2937; padding: 10px; line-height: 1.8; background-color: #ffffff;">
    
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <span style="font-size: 12px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1.5px;">Project Title</span>
          <h1 style="font-size: 28px; color: #111827; margin: 5px 0 0 0; letter-spacing: -0.5px;">
            ${data.title}
          </h1>
        </div>
      </div>
    </div>

    <div style="display: table; width: 100%; margin-bottom: 40px; background-color: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #f3f4f6;">
      <div style="display: table-row;">
        <div style="display: table-cell; padding: 10px;">
          <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Project ID</span>
          <span style="font-size: 14px; color: #111827; font-weight: 600;">${data.projectId || "N/A"
      }</span>
        </div>
        <div style="display: table-cell; padding: 10px;">
          <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Workstream</span>
          <span style="font-size: 14px; color: #111827; font-weight: 600;">${data.workstream || "N/A"
      }</span>
        </div>
        <div style="display: table-cell; padding: 10px;">
          <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Deadline</span>
          <span style="font-size: 14px; color: #ef4444; font-weight: 600;">${data.deadline || "N/A"
      }</span>
        </div>
        <div style="display: table-cell; padding: 10px;">
          <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Budget</span>
          <span style="font-size: 14px; color: #059669; font-weight: 600;">₹${data.budget || "0"
      }</span>
        </div>
      </div>
    </div>

    <div style="margin-top: 10px;">
      <h3 style="font-size: 14px; text-transform: uppercase; color: #1e40af; border-left: 4px solid #3b82f6; padding-left: 12px; margin-bottom: 20px; letter-spacing: 0.5px;">
        Project Scope & Description
      </h3>
      
      <div style="font-size: 15px; color: #374151; text-align: justify; background: #ffffff;">
        ${cleanDescription
        .split("\n")
        .map((p) => `<p style="margin-bottom: 18px;">${p}</p>`)
        .join("")}
      </div>
    </div>

    <div style="margin-top: 60px; pt-20; border-top: 1px solid #eee; text-align: center;">
      <p style="font-size: 10px; color: #9ca3af; margin-top: 15px;">
        Generated on ${new Date().toLocaleDateString()} • Internal Document 
      </p>
    </div>
  </div>
`;
    const blob = await generatePdfBlob(
      html
    );
    const fileName = `Project_Details_${data.projectId}.pdf`;
    return { blob, fileName };
  };

  const generateUpdatePdf = async (
    description: string,
    updateNumber: number,
    projectId: string,
    title: string,
    imageUrl?: string
  ): Promise<{ blob: Blob; fileName: string }> => {
    const formattedDescription = description
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => `<p style="margin-bottom: 20px;">${line}</p>`)
      .join("");

    const html = `
    <div style="font-family: 'Helvetica', 'Arial', sans-serif; color: #1a1a1a; padding: 50px; line-height: 1.8;">
      
      <div style="background-color: #16a34a; height: 8px; width: 120px; margin-bottom: 25px;"></div>
      <h1 style="font-size: 28px; margin-bottom: 10px; color: #111;">Project Update</h1>
      <h2 style="font-size: 20px; font-weight: 400; color: #16a34a; margin-top: 0;">
        Update #${updateNumber}: ${title}
      </h2>

      <div style="display: flex; margin: 40px 0; padding: 25px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
        <div style="flex: 1;">
          <span style="display: block; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px;">Project ID</span>
          <span style="font-weight: 600;">${projectId}</span>
        </div>
        <div style="flex: 1;">
          <span style="display: block; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px;">Date</span>
          <span style="font-weight: 600;">
  ${new Date().toLocaleDateString("en-GB")}
</span>
        </div>
      </div>

      ${imageUrl
        ? `
        <div style="margin: 40px 0; text-align: center; page-break-inside: avoid;">
          <img src="${imageUrl}" style="max-width: 100%; border-radius: 12px; border: 1px solid #ddd;" />
          <div style="height: 30px;"></div> </div>
      `
        : ""
      }

      <div style="margin-top: 20px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #444; margin-bottom: 25px; border-left: 4px solid #16a34a; padding-left: 15px;">
          Update Details
        </h3>
        
        <div style="font-size: 16px; color: #333; letter-spacing: 0.2px;">
          ${formattedDescription}
        </div>
      </div>

      <div style="margin-top: 80px; border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
        <p style="font-size: 11px; color: #aaa;">Document End — Ref: ${projectId}</p>
      </div>
    </div>
  `;

    const blob = await generatePdfBlob(html);
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const fileName = `@update_${safeTitle}.pdf`;

    return { blob, fileName };
  };
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
const fetchProjectData = async (projId: string, isPolling = false) => {
  if (!isPolling) setLoading(true);
  try {
    const projectResponse = await getData(
      `clientproject/get_project/${projId}`
    );
    if (projectResponse && projectResponse.data) {
      const project = projectResponse.data;
      setSelectStream(project.workstream || "");
      setTeamLeaderName(project.teamLeaderName || "");
      setTeamLeaderPic(project.teamLeaderPic || "");
      setTitle(project.title || "");
      setSubmissionDate(project.deadline || "");
      setBudget(project.budget || "");

      // ==================== IMPROVED DESCRIPTION PARSING ====================
      let initialDesc = "";
      if (project.description) {
        const firstDesc = Array.isArray(project.description)
          ? project.description[0]
          : project.description;

        if (typeof firstDesc === "string") {
          try {
            // Handle cases where description was accidentally stringified
            const parsed = JSON.parse(firstDesc);
            initialDesc = typeof parsed === "string" ? parsed : firstDesc;
          } catch {
            initialDesc = firstDesc;
          }
        } else {
          initialDesc = firstDesc || "";
        }
      }
      setInitialDescription(initialDesc);
      // =====================================================================

      setProjectId(projId);
      setIsProjectSubmitted(true);
      setIsChatEnabled(true);

      let newMessages: ChatMessageProps[] = [];

      const parseSection = (
        chats: string[] | undefined,
        audios: string[] | undefined,
        fromClient: boolean,
        fromHead: boolean,
        fromTeamLeader: boolean
      ) => {
        const messages: ChatMessageProps[] = [];
        const max = Math.max(chats?.length || 0, audios?.length || 0);

        for (let i = 0; i < max; i++) {
          // === CHATS column ===
          if (i < (chats?.length || 0)) {
            const chatStr = chats![i];
            if (typeof chatStr === "string") {
              try {
                const parsed = JSON.parse(chatStr);
                let timestamp = parsed.timestamp;
                if (!timestamp || isNaN(new Date(timestamp).getTime())) {
                  timestamp = new Date().toISOString();
                }

                const msg: ChatMessageProps = {
                  type: parsed.type === "text" ? "text" : "file",
                  isLeft: !fromClient,
                  fromClient,
                  fromHead,
                  fromTeamLeader,
                  timestamp,
                  seen_by: parsed.seen_by || [],
                  id: i,
                  mention: parsed.mention || null,
                  replyTo: parsed.replyTo || null,
                  isDeleted: parsed.isDeleted || false,
                  deletedAt: parsed.deletedAt || undefined,
                  edited: parsed.edited || false,
                  editedAt: parsed.editedAt || undefined,
                  caption: parsed.caption || undefined,
                };

                if (!parsed.isDeleted) {
                  if (parsed.type === "text") {
                    msg.message = parsed.data;
                  } else if (parsed.data?.name && parsed.data?.url) {
                    msg.file = {
                      name: parsed.data.name,
                      url: `${serverURL}${parsed.data.url}`,
                      type: parsed.data.type,
                    };
                  }
                }
                messages.push(msg);
              } catch (error) {
                console.error("Error parsing chat:", error);
              }
            }
          }

          // === AUDIOS column ===
          if (i < (audios?.length || 0)) {
            const audioStr = audios![i];
            try {
              const parsed = JSON.parse(audioStr);
              let timestamp = parsed.timestamp;
              if (!timestamp || isNaN(new Date(timestamp).getTime())) {
                timestamp = new Date().toISOString();
              }

              const msg: ChatMessageProps = {
                type: "file",
                isLeft: !fromClient,
                fromClient,
                fromHead,
                fromTeamLeader,
                file: parsed.data?.name && parsed.data?.url
                  ? {
                      name: parsed.data.name,
                      url: `${serverURL}${parsed.data.url}`,
                      type: parsed.data.type,
                    }
                  : undefined,
                timestamp,
                seen_by: parsed.seen_by || [],
                id: i,
                mention: parsed.mention || null,
                replyTo: parsed.replyTo || null,
                isDeleted: parsed.isDeleted || false,
                deletedAt: parsed.deletedAt || undefined,
                edited: parsed.edited || false,
                editedAt: parsed.editedAt || undefined,
                caption: parsed.caption || undefined,
              };
              messages.push(msg);
            } catch (e) {
              console.error("Error parsing audio/file:", e);
            }
          }
        }
        return messages;
      };

      const clientMsgs = parseSection(
        project.clientchats,
        project.clientaudios,
        true,
        false,
        false
      );
      const headMsgs = parseSection(
        project.headchats,
        project.headaudios,
        false,
        true,
        false
      );
      const tlMsgs = parseSection(
        project.tlchats,
        project.tlaudios,
        false,
        false,
        true
      );

      newMessages = [...clientMsgs, ...headMsgs, ...tlMsgs].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
      );
      setChatMessages(newMessages);
      processUpdates(newMessages);
      return project;
    }
  } catch (error) {
    console.error("Error fetching project data:", error);
  } finally {
    if (!isPolling) setLoading(false);
  }
};
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

  const processUpdates = (messages: ChatMessageProps[]) => {
    const tempUpdates: (Omit<UpdateItem, "number"> & {
      parsedNumber?: number;
    })[] = [];
    messages.forEach((msg) => {
      if (
        msg.fromClient &&
        msg.type === "text" &&
        msg.message?.startsWith("@update_")
      ) {
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
      } else if (
        msg.fromClient &&
        msg.type === "file" &&
        msg.file?.name.startsWith("@update_")
      ) {
        const name = msg.file.name;
        let title: string;
        if (name.endsWith(".pdf")) {
          const safeTitle = name.slice(8, -4);
          title = safeTitle
            .split("_")
            .map((word) => word.charAt(0) + word.slice(1))
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
    tempUpdates.sort((a, b) =>
      a.messageTimestamp.localeCompare(b.messageTimestamp)
    );
    const updates = tempUpdates.map((upd, index) => ({
      number: index + 1,
      title: upd.title,
      messageTimestamp: upd.messageTimestamp,
      isText: upd.isText,
    }));
    setUpdatesList(updates);
  };

  useEffect(() => {
    if (isAdd) {
      localStorage.removeItem("selectStream");
      localStorage.removeItem("title");
      localStorage.removeItem("submissionDate");
      localStorage.removeItem("budget");
      localStorage.removeItem("clientDescription");
      localStorage.removeItem("projectId");
      localStorage.removeItem("chatMessages");
      setSelectStream("");
      setTitle("");
      setSubmissionDate("");
      setBudget("");
      setClientDescription("");
      setInitialDescription("");
      setUpdatesList([]);
      setProjectId(null);
      setChatMessages([]);
      setIsProjectSubmitted(false);
      setIsChatEnabled(false);
      setCurrentProjectId(null);
      setUpdateTitle("");
    } else {
      const projId = initialProjectDetails.ProjectId;
      if (projId) {
        setCurrentProjectId(projId);
      }
    }
  }, []);
  useEffect(() => {
    if (currentProjectId) {
      fetchProjectData(currentProjectId);
    }
  }, [currentProjectId]);
  useEffect(() => {
    const urlProjectId = searchParams.get("projectId");
    if (!isAdd && !initialProjectDetails?.ProjectId && urlProjectId) {
      setCurrentProjectId(urlProjectId);
    }
  }, [searchParams, isAdd, initialProjectDetails]);
  useEffect(() => {
    if (socket && connected && projectId) {
      socket.emit("joinProject", projectId);
    }
  }, [socket, connected, projectId]);

  useEffect(() => {
    if (!socket) return;

    onEvent("newMessage", (data: { fromRole: string; msg: any }) => {
      const { fromRole, msg: incoming } = data;
      setChatMessages((prev) => {
        const isDuplicate = prev.some(
          (m) =>
            m.timestamp === incoming.timestamp &&
            ((m.type === "text" && m.message === incoming.data) ||
              (m.type === "file" && m.file?.name === incoming.data?.name))
        );
        if (isDuplicate) return prev;

        const existingIndex = prev.findIndex((m) => m.tempId === incoming.tempId);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], id: incoming.id, tempId: undefined };
          return updated.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        }

        const fromClient = fromRole === "client";
        const fromHead = fromRole === "head";
        const fromTeamLeader = fromRole === "tl";
        const newMsg: ChatMessageProps = {
          type: incoming.type === "text" ? "text" : "file",
          isLeft: !fromClient,
          fromClient,
          fromHead,
          fromTeamLeader,
          timestamp: incoming.timestamp,
          seen_by: incoming.seen_by,
          id: incoming.id,
          mention: incoming.mention,
          replyTo: incoming.replyTo,
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
        return [...prev, newMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      });
      playNotification();
    });

    onEvent(
      "messageSeen",
      (data: { fromRole: string; index: number; seen_by: string[]; timestamp?: string }) => {
        const { fromRole, index, seen_by, timestamp } = data;
        setChatMessages((prev) => {
          const fromClient = fromRole === "client";
          const fromHead = fromRole === "head";
          const fromTeamLeader = fromRole === "tl";
          return prev.map((m) =>
            (m.timestamp === timestamp &&
              m.fromClient === fromClient &&
              m.fromHead === fromHead &&
              m.fromTeamLeader === fromTeamLeader) ||
              (m.id === index &&
                ((fromRole === "client" && m.fromClient) ||
                  (fromRole === "head" && m.fromHead) ||
                  (fromRole === "tl" && m.fromTeamLeader)))
              ? { ...m, seen_by }
              : m
          );
        });
      }
    );

    // ✅ FIX: now inside if(!socket) guard
    onEvent(
      "clientMessageEdited",
      (data: { projectId: string; index: number; updatedMsg: any }) => {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.timestamp === data.updatedMsg.timestamp || m.id === data.index
              ? {
                ...m,
                message: data.updatedMsg.data, // ✅ FIX: server sends `data`, map to `message`
                edited: true,
                editedAt: data.updatedMsg.editedAt,
              }
              : m
          )
        );
      }
    );

    onEvent(
      "clientMessageDeleted",
      (data: { projectId: string; index: number; updatedMsg: any }) => {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.timestamp === data.updatedMsg.timestamp || m.id === data.index
              ? {
                ...m,
                isDeleted: true,
                deletedAt: data.updatedMsg.deletedAt,
                message: undefined, // ✅ FIX: explicitly clear
                file: undefined,
              }
              : m
          )
        );
      }
    );
  }, [socket, playNotification]);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const idx = target.dataset.idx;
            if (idx) {
              const msg = chatMessages[parseInt(idx)];
              const viewer = "client";
              if (
                msg &&
                msg.isLeft &&
                !msg.fromClient &&
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
  }, [chatMessages, socket, onEvent]);
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
  const requiresPreview = (msg: ChatMessageProps) => {
    if (msg.type === "text") return false;
    if (!msg.file?.type) return false;
    const ft = msg.file.type;
    if (ft.startsWith("audio/") || ft.startsWith("video/")) return false;
    return true;
  };
  const markMessageAsSeen = async (msg: ChatMessageProps) => {
    if (!projectId || msg.id === undefined) {
      return;
    }
    let messageType =
      msg.type === "file" && msg.file?.type.startsWith("audio/")
        ? "audio"
        : "chat";
    const fromClient = msg.fromClient;
    const viewer = "client";
    try {
      const response = await postData(
        `clientproject/mark_message_seen/${projectId}`,
        {
          index: msg.id,
          fromClient,
          fromHead: msg.fromHead,
          fromTeamLeader: msg.fromTeamLeader,
          type: messageType,
          viewer,
          timestamp: msg.timestamp,
        }
      );
      if (response.status) {
        setChatMessages((prev) =>
          prev.map((m) =>
            (m.id === msg.id &&
              m.fromClient === fromClient &&
              m.fromHead === msg.fromHead &&
              m.fromTeamLeader === msg.fromTeamLeader) ||
              (m.timestamp === msg.timestamp &&
                m.fromClient === fromClient &&
                m.fromHead === msg.fromHead &&
                m.fromTeamLeader === msg.fromTeamLeader)
              ? { ...m, seen_by: [...new Set([...m.seen_by, viewer])] }
              : m
          )
        );
      } else {
        console.error("Failed to mark message as seen:", response.message);
      }
    } catch (error) {
      console.error("Error marking message as seen:", error);
    }
  };
  useEffect(() => {
    if (chatContainerRef.current) {
      if (autoScrollRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
        setShowScrollToBottom(false);
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
        setShowScrollToBottom(!isNearBottom);
      }
    };
    chatContainer?.addEventListener("scroll", handleScroll);
    return () => chatContainer?.removeEventListener("scroll", handleScroll);
  }, [chatMessages]);
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
      setShowScrollToBottom(false);
    }
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
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isXXS = width <= 480;
  const isXS = width > 480 && width <= 640;
  const isSM = width > 640 && width <= 768;
  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;
  const getSenderInfo = (msg: ChatMessageProps) => {
    if (msg.fromClient) {
      return {
        role: "You",
        name: parsedData?.clientName,
      };
    } else if (msg.fromHead) {
      return { role: "Head", name: headName || "Unknown Head" };
    } else if (msg.fromTeamLeader) {
      return {
        role: "Team Leader",
        name: teamLeaderName || "Unknown Team Leader",
      };
    }
    return { role: "Unknown", name: "Unknown" };
  };
  const getSeenText = (msg: ChatMessageProps) => {
    if (msg.seen_by.length === 0) return "Not seen yet";
    let text = "Seen by ";
    if (msg.seen_by.includes("head")) text += `Head (${headName || "head"}), `;
    if (msg.seen_by.includes("tl"))
      text += `Team Leader (${teamLeaderName || "TL"})`;
    if (text.endsWith(", ")) text = text.slice(0, -2);
    return text;
  };
  const isAllSeen = (msg: ChatMessageProps) => {
    return msg.seen_by.includes("head") && msg.seen_by.includes("tl");
  };
  const handleFileUpload = async () => {
    if (
      !selectStream ||
      !title ||
      !submissionDate ||
      !budget ||
      !clientDescription
    ) {
      return;
    }
    setLoading(true);
    const body = {
      workstream: selectStream,
      title,
      deadline: submissionDate,
      budget,
      description: clientDescription,
      clientid: parsedData?.clientId,
    };
    try {
      const response = await postData(`clientproject/save_project`, body);
      if (response && response.data?.project_id) {
        const newProjectId = response.data.project_id;
        const timestamp = new Date().toISOString();
        const { blob, fileName } = await generateProjectDetailsPdf({
          workstream: selectStream,
          title,
          deadline: submissionDate,
          budget,
          description: clientDescription,
          projectId: newProjectId,
        });
        const formData = new FormData();
        formData.append("file", blob, fileName);
        formData.append("projectId", newProjectId);
        const uploadResponse = await postData(
          `clientproject/upload_file`,
          formData
        );
        if (uploadResponse.status) {
          const url = uploadResponse.data?.fileUrl || "";
          if (url) {
            const tempId = uuidv4();
            const optimisticMsg: ChatMessageProps = {
              type: "file",
              isLeft: false,
              fromClient: true,
              fromHead: false,
              fromTeamLeader: false,
              file: {
                name: fileName,
                url: `${serverURL}${url}`,
                type: "application/pdf",
              },
              timestamp,
              seen_by: [],
              tempId,
            };
            setChatMessages((prev) =>
              [...prev, optimisticMsg].sort((a, b) =>
                a.timestamp.localeCompare(b.timestamp)
              )
            );
            socket?.emit("sendClientMessage", {
              projectId: newProjectId,
              type: "file",
              msgData: { name: fileName, url, type: "application/pdf" },
              timestamp,
              mention: null,
              tempId,
            });
            playNotification();
            setProjectId(newProjectId);
            setCurrentProjectId(newProjectId);
            setIsProjectSubmitted(true);
            setIsChatEnabled(true);
            await fetchProjectData(newProjectId, false);
          }
        }
        setSelectStream("");
        setTitle("");
        setSubmissionDate("");
        setBudget("");
        setClientDescription("");
        localStorage.removeItem("selectStream");
        localStorage.removeItem("title");
        localStorage.removeItem("submissionDate");
        localStorage.removeItem("budget");
        localStorage.removeItem("clientDescription");
      }
    } catch (error) {
      console.error("Error saving project:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleFileUploadForUpdate = async (file: File): Promise<string> => {
    if (!projectId) throw new Error("No project ID");
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("projectId", projectId);
    const response = await postData(`clientproject/upload_file`, formData);
    if (response.status && response.data?.fileUrl) {
      return `${serverURL}${response.data.fileUrl}`;
    }
    throw new Error("Upload failed");
  };

  const handleFileUploadForDescription = async (file: File): Promise<string> => {
    if (!projectId && !isProjectSubmitted) {
      // For new projects, we need to upload temporarily and store URL
      // Since projectId doesn't exist yet, upload to a temp location or handle differently
      const formData = new FormData();
      formData.append("file", file, file.name);
      // Use a generic endpoint or create temp project first
      const response = await postData(`clientproject/upload_file_temp`, formData);
      if (response.status && response.data?.fileUrl) {
        return `${serverURL}${response.data.fileUrl}`;
      }
      throw new Error("Upload failed");
    }
    // Fallback to regular upload if project exists
    return handleFileUploadForUpdate(file);
  };

  const handleToggleUpdate = () => {
    if (update) {
      setUpdateTitle("");
    }
    setUpdate(!update);
  };
  const handleUpdateProject = async () => {
    if (!projectId || !updateTitle.trim()) {
      alert("Please provide at least a title for the update.");
      return;
    }
    setLoading(true);
    const timestamp = new Date().toISOString();
    const updateNumber = updatesList.length + 1;
    const contentHTML = updates.trim();
    const plainContent = updates.replace(/<[^>]*>/g, "").trim();
    const hasRichContent =
      /<(strong|em|a|ul|ol|li|h[1-6]|blockquote|pre|code|img|iframe)/i.test(
        contentHTML
      );
    const title = updateTitle.trim();
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
    const baseName = `@update_${safeTitle}`;
    const fullTextPrefix = `${baseName}: `;
    const fullMessage = fullTextPrefix + plainContent;
    try {
      if (hasRichContent && contentHTML) {
        const pdfResult = await generateUpdatePdf(
          contentHTML,
          updateNumber,
          projectId!,
          title || `Update #${updateNumber}`
        );
        const formData = new FormData();
        formData.append("file", pdfResult.blob, pdfResult.fileName);
        formData.append("projectId", projectId);
        const uploadRes = await postData(`clientproject/upload_file`, formData);
        if (uploadRes.status && uploadRes.data?.fileUrl) {
          const fileTempId = uuidv4();
          const optimisticFileMsg: ChatMessageProps = {
            type: "file",
            isLeft: false,
            fromClient: true,
            fromHead: false,
            fromTeamLeader: false,
            file: {
              name: pdfResult.fileName,
              url: `${serverURL}${uploadRes.data.fileUrl}`,
              type: "application/pdf",
            },
            timestamp,
            seen_by: [],
            tempId: fileTempId,
          };
          setChatMessages((prev) =>
            [...prev, optimisticFileMsg].sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            )
          );
          socket?.emit("sendClientMessage", {
            projectId,
            type: "file",
            msgData: {
              name: pdfResult.fileName,
              url: uploadRes.data.fileUrl,
              type: "application/pdf",
            },
            timestamp,
            mention: null,
            tempId: fileTempId,
          });
          playNotification();
        }
      } else {
        const tempId = uuidv4();
        const optimisticMsg: ChatMessageProps = {
          type: "text",
          isLeft: false,
          fromClient: true,
          fromHead: false,
          fromTeamLeader: false,
          message: fullMessage,
          timestamp,
          seen_by: [],
          tempId,
          mention: null,
        };
        setChatMessages((prev) =>
          [...prev, optimisticMsg].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
          )
        );
        socket?.emit("sendClientMessage", {
          projectId,
          type: "text",
          msgData: fullMessage,
          timestamp,
          mention: null,
          tempId,
        });
        playNotification();
      }

      await postData(`clientproject/update_project/${projectId}`, {
        description: title,
      });
      setUpdates("");
      setUpdateTitle("");
      setUpdate(false);
    } catch (error) {
      console.error("Error sending update:", error);
      alert("Failed to send update. Please try again.");
    } finally {
      setLoading(false);
    }
  };
const handleSendMessage = async (
  message: string,
  type: "text" | "voice" | "file" = "text",
  files?: { name: string; url: string; type: string; blob?: Blob }[],
  caption?: string   // ← NEW: This is what MikeSearch now sends
) => {
  // If editing a message, only intercept text sends (files/voice go through normally)
  if (editingMessage && type === "text") {
    await sendEditedMessage();
    return;
  }

  if (
    (message.trim() || (files && files.length > 0)) &&
    isChatEnabled &&
    projectId &&
    socket &&
    connected
  ) {
    setLoading(true);
    try {
      const timestamp = new Date().toISOString();
      let mention = null;

      if (type === "text" && message.trim()) {
        mention = detectMention(message);
        const tempId = uuidv4();
        const optimisticMsg: ChatMessageProps = {
          message,
          type: "text",
          isLeft: false,
          fromClient: true,
          fromHead: false,
          fromTeamLeader: false,
          timestamp,
          seen_by: [],
          tempId,
          mention,
          replyTo: replyToMessage,
        };
        setChatMessages((prev) =>
          [...prev, optimisticMsg].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
          )
        );
        socket.emit("sendClientMessage", {
          projectId,
          type: "text",
          msgData: message,
          timestamp,
          mention,
          tempId,
          replyTo: replyToMessage,
        });
        playNotification();
        setNewMessage("");
        setReplyToMessage(null);
      } 
      else if (type === "voice" && files && files[0]?.blob) {
        // ← Your existing voice code (unchanged)
        const file = files[0];
        const formData = new FormData();
        formData.append("file", file.blob!, file.name);
        formData.append("projectId", projectId);
        const uploadResponse = await postData(
          `clientproject/upload_file`,
          formData
        );
        if (uploadResponse.status) {
          const url = uploadResponse.data?.fileUrl || "";
          if (url) {
            const tempId = uuidv4();
            const optimisticMsg: ChatMessageProps = {
              type: "file",
              isLeft: false,
              fromClient: true,
              fromHead: false,
              fromTeamLeader: false,
              file: {
                name: file.name,
                url: `${serverURL}${url}`,
                type: file.type || "audio/mp3",
              },
              timestamp,
              seen_by: [],
              tempId,
              mention: null,
              replyTo: replyToMessage,
            };
            setChatMessages((prev) =>
              [...prev, optimisticMsg].sort((a, b) =>
                a.timestamp.localeCompare(b.timestamp)
              )
            );
            socket.emit("sendClientMessage", {
              projectId,
              type: "audio",
              msgData: {
                name: file.name,
                url,
                type: file.type || "audio/mp3",
              },
              timestamp,
              mention: null,
              tempId,
              replyTo: replyToMessage,
            });
            playNotification();
            setReplyToMessage(null);
          }
        }
      } 
      else if (type === "file" && files && files.length > 0) {
        // ← UPDATED FILE BLOCK (now uses caption from MikeSearch)
        for (const file of files) {
          if (file.blob) {
            const formData = new FormData();
            formData.append("file", file.blob, file.name);
            formData.append("projectId", projectId);
            const uploadResponse = await postData(
              `clientproject/upload_file`,
              formData
            );
            if (uploadResponse.status) {
              const url = uploadResponse.data?.fileUrl || "";
              if (url) {
                const tempId = uuidv4();
                const optimisticMsg: ChatMessageProps = {
                  type: "file",
                  isLeft: false,
                  fromClient: true,
                  fromHead: false,
                  fromTeamLeader: false,
                  file: {
                    name: file.name,
                    url: `${serverURL}${url}`,
                    type: file.type,
                  },
                  caption: caption || message.trim() || undefined,   // ← Caption support
                  timestamp,
                  seen_by: [],
                  tempId,
                  mention: null,
                  replyTo: replyToMessage,
                };
                setChatMessages((prev) =>
                  [...prev, optimisticMsg].sort((a, b) =>
                    a.timestamp.localeCompare(b.timestamp)
                  )
                );
                socket.emit("sendClientMessage", {
                  projectId,
                  type: "file",
                  msgData: { name: file.name, url, type: file.type },
                  caption: caption || message.trim() || null,   // ← Send caption to backend
                  timestamp,
                  mention: null,
                  tempId,
                  replyTo: replyToMessage,
                });
                playNotification();
                setReplyToMessage(null);
              }
            }
          }
        }
      }

      setSelectedFiles([]);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
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
  const handleDownloadFile = async (url: string, name: string) => {
    try {
      const finalURL =
        url.startsWith("blob:") ||
          url.startsWith("http://") ||
          url.startsWith("https://")
          ? url
          : `${serverURL}${url}`;

      if (finalURL.startsWith("blob:")) {
        const link = document.createElement("a");
        link.href = finalURL;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const response = await fetch(finalURL, {
        mode: "cors",
        credentials: "include",
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
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download the file. Please try again.");
    }
  };

  const handlePreviewHeightChange = (height: number) => {
    setPreviewHeight(height);
  };
  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };
  const handleOpenPreview = (
    file: { name: string; url: string; type: string; blob?: Blob } | undefined,
    msg: ChatMessageProps
  ) => {
    if (file) {
      setSelectedFile({ name: file.name, url: file.url, type: file.type });
      setIsModalOpen(true);
      const isReceived = msg.isLeft && !msg.fromClient;
      const viewer = "client";
      if (isReceived && !msg.seen_by.includes(viewer) && msg.id !== undefined) {
        markMessageAsSeen(msg);
      }
    }
  };
  const renderPreview = (file: SelectedFile) => {
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
          title={"name"}
          className="w-full h-[80vh] border-none"
        />
      );
    } else if (
      type === "application/msword" ||
      type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      type === "application/zip"
    ) {
      return (
        <iframe
          src={url}
          title={name}
          className="w-full h-[80vh] border-none"
        />
      );
    } else {
      return (
        <p className="text-gray-600 italic">
          Preview not available for this file type. Please download to view.
        </p>
      );
    }
  };
  let displayedMessages = chatMessages;
  if (currentTab === "files") {
    displayedMessages = chatMessages.filter((msg) => msg.type === "file");
  }
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
  useEffect(() => {
    processUpdates(chatMessages);
  }, [chatMessages]);

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
      className={`flex flex-col w-full text-black ${isLG
          ? "px-16 py-20 overflow-y-auto min-h-screen justify-center"
          : isXL || is2XL
            ? "px-24 min-h-screen overflow-y-auto py-20 justify-center"
            : "px-4 py-26"
        } items-center relative`}
    >
      <MainNavigation isMenuHide={false} />

      <div className="w-full flex items-start space-x-7">
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
            className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200/50 shadow-lg z-50 transform transition-transform duration-300 ${isDrawerOpen ? "translate-x-0" : "-translate-x-full"
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
                // No onStepClick for Client (view-only)
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
        {isLG || isXL || is2XL ? (
          <div className="flex justify-center">
            <ProgressTracking
              progress={progress}
            // No onStepClick for Client (view-only)
            />
          </div>
        ) : null}
        <div className="w-full flex flex-col space-y-7">
          <div
            ref={isLG ? descriptionRef : undefined}
            className={`w-full grid ${isLG || isXL || is2XL ? "grid-cols-2 gap-16" : "grid-cols-1 gap-4"
              }`}
          >
            <div className="flex w-full flex-col items-start">
              <div className="w-full items-start flex mb-8 flex-col">
                {isProjectSubmitted && (
                  <div className="mb-4">
                    <Button1
                      value={selectStream || initialProjectDetails?.Workstream}
                      gradientType="gradient1"
                    />
                  </div>
                )}
                <div className="leading-relaxed flex items-start flex-col">
                  <div className={`mb-1 ${is2XL ? "text-sm " : "text-xs"}`}>
                    {storedUserRole === "Client"
                      ? parsedData?.clientName
                      : storedUserRole === "Employee"
                        ? parsedData?.employeeName
                        : storedUserRole === "Head"
                          ? parsedData?.headName
                          : ""}
                  </div>
                  {isProjectSubmitted && (
                    <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                      Project ID: <span className="font-semibold">{projectId}</span>
                    </div>
                  )}
                  {isProjectSubmitted && (
                    <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                      Submission Date:{" "}
                      <span className="">
                        {new Date(submissionDate || initialProjectDetails?.SubmissionDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div
                ref={isLG ? undefined : descriptionRef}
                className="w-full text-start rounded-xl border border-gray-200 flex flex-col items-start bg-white p-6 shadow-sm"
              >
                <div className="text-[15px] text-[#0587F5] mb-2 flex items-center gap-x-1.5 font-semibold">
                  <span>
                    <TbListDetails />
                  </span>
                  {isProjectSubmitted ? "Project Details" : "Submit Project"}
                </div>
                {isProjectSubmitted && (
                  <div className="flex items-start flex-col border-b border-black w-full pb-4 mb-4">
                    <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {selectStream || initialProjectDetails?.Workstream}
                    </span>
                    <h3 className="mt-2 text-md font-bold text-gray-900">
                      {title || initialProjectDetails?.Title}
                    </h3>
                  </div>
                )}
                {!hasProjectDetailsData && !isProjectSubmitted ? (
                  <div
                    className={`w-full ${is2XL ? "text-[14px]" : "text-[12px]"
                      } flex flex-col space-y-4 items-start`}
                  >
                    <div className="w-full p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
                      <select
                        value={selectStream}
                        onChange={(e) => setSelectStream(e.target.value)}
                        className="w-full px-4 py-1 text-[12px] rounded-[4px] bg-[#F5F5F5] text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
                      >
                        <option value="" disabled hidden>
                          ---Select Workstream---
                        </option>
                        <option>Data Science</option>
                        <option>AI</option>
                        <option>Plagarism removal</option>
                        <option>Thesis</option>
                        <option>Software Development</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full px-4 py-1 text-[12px] rounded-[4px] bg-[#F5F5F5] text-gray-800 placeholder-gray-400 border-2 border-blue-300 focus:ring-0 outline-none transition pr-10"
                    />
                    <div className="flex items-center space-x-4 w-full">
                      <input
                        type={isDateType ? "date" : "text"}
                        value={submissionDate}
                        onChange={(e) => setSubmissionDate(e.target.value)}
                        onFocus={() => setIsDateType(true)}
                        onBlur={(e) => {
                          if (!e.target.value) setIsDateType(false);
                        }}
                        placeholder={isDateType ? "" : "Deadline"}
                        className="w-full px-4 py-1 text-[12px] rounded-[4px] bg-[#F5F5F5] text-gray-800 placeholder-gray-400 border-2 border-blue-300 focus:ring-0 outline-none transition pr-10"
                      />
                      <input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="Budget"
                        className="w-full px-4 py-1 text-[12px] rounded-[4px] bg-[#F5F5F5] text-gray-800 placeholder-gray-400 border-2 border-blue-300 focus:ring-0 outline-none transition pr-10"
                      />
                    </div>
                    <QuillEditor
                      initialText={clientDescription}
                      onChange={setClientDescription}
                      onFileUpload={handleFileUploadForDescription}
                      placeholder="Describe your project requirements..."
                    />
                  </div>
                ) : (
                  <div
                    className={`w-full ${is2XL ? "text-[14px]" : "text-[12px]"
                      } flex flex-col space-y-4 items-start`}
                  >
                    {!update ? (
                      <div className="w-full">
                        {initialDescription && (
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
                                __html: DOMPurify.sanitize(initialDescription),
                              }}
                            />
                          </div>
                        )}
                        {(() => {
                          return (
                            <div className="max-h-[200px] mb-4 overflow-y-auto thin-scroll">
                              <div className="text-md font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full ring-1 ring-inset ring-green-300 w-fit">
                                #Updates
                              </div>
                              <div className="pt-1">
                                {updatesList.length > 0 ? (
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
                        <div className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:space-y-0">
                          <div className="flex items-center gap-x-1 text-gray-500">
                            <RiTimeLine size={15} color="#FF0A78" />
                            <span className="font-semibold text-gray-800">
                              {new Date(
                                submissionDate ||
                                initialProjectDetails?.SubmissionDate
                              ).toLocaleDateString("en-CA")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            <span className="font-semibold text-gray-800">
                              ₹{budget || initialProjectDetails?.Budget}/-
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={updateTitle}
                          onChange={(e) => setUpdateTitle(e.target.value)}
                          placeholder="Enter update title"
                          className="w-full px-4 py-2 text-[12px] rounded-[4px] bg-[#F5F5F5] text-gray-800 placeholder-gray-400 border-2 border-blue-300 focus:ring-0 outline-none transition mb-2"
                        />
                        <QuillEditor
                          initialText={updates}
                          onChange={setUpdates}
                          placeholder="write your updates here..."
                          onFileUpload={handleFileUploadForUpdate}
                          onClose={handleToggleUpdate}
                        />
                      </>
                    )}
                  </div>
                )}
                <div className="w-fit space-y-3 mt-7">
                  {hasProjectDetailsData || isProjectSubmitted ? (
                    <Button2
                      disabled={isCompleted || loading}
                      value={
                        !update
                          ? loading
                            ? "Loading..."
                            : "Update"
                          : loading
                            ? "Sending Update..."
                            : "Send Update"
                      }
                      onClick={!update ? handleToggleUpdate : handleUpdateProject}
                    />
                  ) : (
                    <Button3
                      value={loading ? "Adding..." : "Add File"}
                      onClick={handleFileUpload}
                    />
                  )}
                </div>
              </div>
            </div>
            <div
              className={`w-full min-h-[300px] max-h-[550px] flex flex-col items-center justify-between  ${(isChatEnabled && !isCompleted)
                  ? "bg-[#CFE3FF] pb-10 bg-gradient-to-t from-[#f0f9fd] to-[#CFE3FF]  ring-1 ring-inset ring-cyan-100/50 text-slate-500 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)] shadow-[#8A8A8A] rounded-[10px]"
                  : "bg-[#dddddd] pb-5"
                } rounded-[10px]`}
            >
              <div className="w-full relative items-center h-[500px] max-h-[500px] justify-start flex flex-col">
                <div
                  className="flex items-center w-fit rounded-md justify-center text-white"
                  style={{
                    background: (isProjectSubmitted && !isCompleted)
                      ? !(currentTab === "chat")
                        ? "conic-gradient(from 0deg at 49.56% 50%, #011B40 0deg, #0348A6 360deg)"
                        : "conic-gradient(from 0deg at 49.56% 50%, #0348A6 0deg, #011B40 360deg)"
                      : "conic-gradient(from 0deg at 49.56% 50%, #474747 0deg, #9A9A9A 360deg)",
                  }}
                >
                  <div
                    className={`flex ${is2XL ? "text-sm" : "text-xs"
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
                  className={`w-full rounded-md px-4 ${is2XL ? "text-sm" : "text-xs"
                    } flex-1 overflow-y-auto thin-scroll space-y-2`}
                  style={{
                    paddingTop: "16px",
                    paddingBottom:
                      previewHeight > 0 ? `${previewHeight + 20}px` : "30px",
                  }}
                >
                  {(() => {
                    let currentDate = "";
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
                            className={`flex ${msg.isLeft ? "justify-start" : "justify-end"
                              } my-5`}
                          >
                            <div
                              className={`flex ${isXXS || isXS
                                  ? "w-[250px]"
                                  : isSM
                                    ? "w-[280px]"
                                    : isMD
                                      ? "w-[300px]"
                                      : isLG
                                        ? "w-[250px]"
                                        : isXL
                                          ? "w-[300px]"
                                          : is2XL
                                            ? "w-[350px]"
                                            : "w-[40%]"
                                } items-center ${msg.isLeft ? "flex-row" : "flex-row-reverse"
                                }`}
                            >
                              <div
                                className={`${msg.isLeft ? "mr-2" : "ml-2"
                                  } w-8 h-8 shrink-0 rounded-full flex items-center justify-center`}
                              >
                                {!storedUserData ? (
                                  <img
                                    src={UserIcon}
                                    alt="User Icon"
                                    className="w-full h-full"
                                  />
                                ) : (
                                  <img
                                    src={`${serverURL}/files/${msg.fromClient
                                        ? parsedData?.clientPic
                                        : msg.fromHead
                                          ? headPic
                                          : teamLeaderPic
                                      }`}
                                    alt="Profile"
                                    className="w-10 h-8 rounded-full border-2 border-blue-500/50"
                                    onError={(e) => {
                                      e.currentTarget.src = UserIcon;
                                    }}
                                  />
                                )}
                              </div>
                              <div
                                className={` ${msg.isLeft
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
                                {/* MAIN BUBBLE - FINAL CLEAN WITH 3-DOT MENU */}
                                <div
                                  className={`group relative backdrop-blur-xl sm:w-fit sm:max-w-[250px] md:w-fit md:max-w-[180px] lg:w-fit lg:max-w-[220px] w-fit max-w-[180px] ${msg.isLeft
                                      ? "bg-white border-l-blue-600/30 border-l-[3px]"
                                      : "bg-[#fffddc] border-r-yellow-600/30 border-r-[3px]"
                                    } shadow-[0_4px_20px_-4px_rgba(100,116,139,0.12)] p-3 rounded-2xl ${msg.isLeft ? "rounded-tl-none" : "rounded-br-none"
                                    }`}
                                >
                                  {msg.replyTo && (
                                    <div
                                      onClick={() => handleClickOnReplyBubble(msg.replyTo!)}
                                      className="mb-2 p-2 bg-[#ececec] rounded-md border-l-4 border-blue-500 cursor-pointer hover:bg-gray-200 transition"
                                    >
                                      <div className="text-xs font-medium text-gray-600">
                                        {msg.replyTo.sender === localRole ? "You" : msg.replyTo.sender}
                                      </div>
                                      <div className="text-xs text-gray-500 truncate">
                                        {msg.replyTo.content}
                                      </div>
                                    </div>
                                  )}

                                  {msg.isDeleted ? (
                                    <div className="text-gray-400 italic text-xs flex items-center gap-1">
                                      <MdBlock size={14} />
                                      {msg.fromClient ? "You deleted this message" : "This message was deleted"}
                                    </div>
                                  ) : (
                                    <>
                                      {msg.message && msg.type === "text" && (
                                        <div
                                          className="text-gray-900 text-sm leading-snug [word-break:break-word] [hyphens:auto]"
                                          dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(
                                              highlightMessageText(msg.message || "", msg.mention)
                                            ),
                                          }}
                                        />
                                      )}

                                      {/* FULL FILE RENDERING - tumhara purana code yahin hai */}
{msg.file && msg.file.url && msg.file.name && !msg.isDeleted && (
  <div
    ref={index === msgControl ? divRef : null}
    onClick={() => setMsgControl(msgControl === index ? null : index)}
    className="group relative mt-1 h-fit shadow-sm shadow-amber-200 max-w-[300px] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 ease-out hover:border-slate-400 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] active:scale-[0.985]"
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
        } else if (fileType.includes("word")) {
          Icon = FaFileWord;
          color = "text-sky-600";
        } else if (fileType === "application/zip") {
          Icon = FaFileArchive;
          color = "text-amber-500";
        }
        return (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 ${color}`}>
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
      const { type, url: rawUrl, name } = msg.file;
      const url = rawUrl.startsWith("blob:") ? rawUrl : rawUrl;

      if (type.startsWith("audio/")) {
        return (
          <div className="px-3 pb-2">
            <audio controls src={url} className="block h-7 w-full opacity-80 hover:opacity-100 m-0 p-0" />
          </div>
        );
      }
      if (type.startsWith("image/")) {
        return (
          <div className="relative mx-3 mb-2 overflow-hidden rounded-lg border border-slate-100">
            <img src={url} alt={name} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            {msgControl === index && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                <ActionBar msg={msg} index={index} url={url} name={name} />
              </div>
            )}
          </div>
        );
      }
      if (type.startsWith("video/")) {
        return (
          <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-slate-100">
            <video src={url} className="block aspect-video w-full object-cover bg-black m-0" />
          </div>
        );
      }
      return (
        <div className="px-3 pb-2">
          {msgControl === index && (
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
              <ActionBar msg={msg} index={index} url={url} name={name} />
            </div>
          )}
        </div>
      );
    })()}

    {/* 🔥 NEW: Caption display (text attached with file) */}
    {msg.caption && (
      <div className="px-3 pb-3 text-gray-800 text-[13px] break-words leading-snug border-t border-slate-100 pt-2">
        {msg.caption}
      </div>
    )}
  </div>
)}

                                      {msg.caption && (
                                        <div className="text-gray-800 text-[13px] mt-1.5 px-1 break-words leading-snug">
                                          {msg.caption}
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                                        {new Date(msg.timestamp).toLocaleTimeString("en-IN", {
                                          hour: "numeric",
                                          minute: "2-digit",
                                          hour12: true,
                                        })}
                                        {msg.edited && <span className="text-[10px] text-blue-500 font-medium ml-1">Edited</span>}
                                        {!msg.isLeft && (
                                          <span className="inline-flex items-center">
                                            <IoCheckmarkDoneSharp size={14} color={isAllSeen(msg) ? "#00B7FF" : "#000000"} />
                                            <FaInfoCircle size={12} color="#808080" title={getSeenText(msg)} className="ml-1 cursor-help" />
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* 3-DOT MENU */}
                                  {msg.fromClient && !msg.isDeleted && (
                                    <div
                                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer z-10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMessageMenuIndex(messageMenuIndex === index ? null : index);
                                      }}
                                    >
                                      <div className="bg-white shadow-md hover:bg-red-50 rounded-full p-1 text-gray-500 hover:text-red-700"><BsThreeDotsVertical /></div>
                                    </div>
                                  )}

                                  {/* MENU POPOVER */}
                                  {messageMenuIndex === index && msg.fromClient && !msg.isDeleted && (
                                    <div
                                      className="absolute top-2 right-0 bg-white shadow-xl rounded-xl py-1 w-fit text-sm border border-gray-100"
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      {msg.type === "text" && (
                                        <div
                                          onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }}
                                          className="px-4 py-2 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                                        >
                                          <MdEdit size={16} />
                                          <span>Edit</span>
                                        </div>
                                      )}
                                      <div
                                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg); }}
                                        className="px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                                      >
                                        <MdDelete size={16} />
                                        <span>Delete</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                              </div>
                              {msg.isLeft && (
                                <div
                                  onClick={() => handleReplyToMessage(msg)}
                                  className="transition-all duration-200 cursor-pointer p-0.5 rounded-full bg-slate-50 border border-slate-300 flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] hover:bg-slate-800 hover:text-white hover:border-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(59,130,246,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-slate-500"
                                >
                                  <MdOutlineReply size={15} />
                                </div>
                              )}
                              {!msg.isLeft && (
                                <div
                                  onClick={() => handleReplyToMessage(msg)}
                                  className="transition-all duration-200 cursor-pointer p-0.5 rounded-full bg-slate-50 border border-slate-300 flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] hover:bg-slate-800 hover:text-white hover:border-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(59,130,246,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-slate-500"
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
                    <div className="flex justify-start my-2">
                      <div className="flex items-center flex-row">
                        <div className="w-8 h-8 mr-2 shrink-0 rounded-full flex items-center justify-center">
                          {!storedUserData ? (
                            <img
                              src={UserIcon}
                              alt="User Icon"
                              className="w-full h-full"
                            />
                          ) : (
                            <img
                              src={`${serverURL}/files/${storedUserRole === "Employee"
                                  ? parsedData?.employeePic
                                  : storedUserRole === "Client"
                                    ? parsedData?.clientPic
                                    : storedUserRole === "Head"
                                      ? parsedData?.headPic
                                      : ""
                                }`}
                              alt="Profile"
                              className="w-10 h-8 rounded-full border-2 border-blue-500/50"
                            />
                          )}
                        </div>
                        <div
                          className={`${isSM || isXS || isXXS
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
                          <style>
                            {`
                              @keyframes bounceDot {
                                0%, 100% {
                                  transform: translateY(0);
                                }
                                50% {
                                  transform: translateY(-4px);
                                }
                              }
                            `}
                          </style>
                        </div>
                      </div>
                    </div>
                  )}
                  {showScrollToBottom && (
                    <div
                      onClick={scrollToBottom}
                      className="absolute bottom-4 cursor-pointer right-4 w-fit z-10 p-1.5 bg-[#9C9C9C] text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-110"
                    >
                      <MdOutlineDoubleArrow className="rotate-90" size={12} />
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
                  disabled={!isChatEnabled || isCompleted}
                  placeholder={
                    isChatEnabled
                      ? "Type your message..."
                      : "Upload a file to enable chat"
                  }
                  onPreviewHeightChange={handlePreviewHeightChange}
                  allowedFileTypes={[
                    "image/*",
                    "video/*",
                    "audio/*",
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/zip",
                  ]}
                  inputRef={inputRef}
                  mentionOptions={mentionOptions}
                  onMentionSelect={handleMentionSelect}
                  replyTo={replyToMessage}
                  onCancelReply={() => {
                    setReplyToMessage(null);
                    setEditingMessage(null);
                    setNewMessage("");
                  }}
                  editingMessage={editingMessage ? { content: editingMessage.message || "" } : null}
                  onCancelEdit={() => {
                    setEditingMessage(null);
                    setNewMessage("");
                  }}
                  projectId={projectId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectedFiles.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-xl font-bold text-gray-800">Files</h2>
              <div
                onClick={() => setSelectedFiles([])}
                className="text-gray-500 cursor-pointer bg-green-200 rounded-full p-1 hover:scale-110 hover:text-red-600 transition-colors"
                title="Close"
                aria-label="Close file modal"
              >
                <FiX size={22} />
              </div>
            </div>
            <div className="space-y-4">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:shadow-md transition-shadow"
                >
                  <a
                    href={
                      file.url.startsWith("blob:")
                        ? file.url
                        : `${serverURL}${file.url}`
                    }
                    download={file.name}
                    className="text-blue-600 underline truncate w-[70%]"
                  >
                    {file.name}
                  </a>
                  <div className="flex space-x-2">
                    <div
                      onClick={() => handleOpenPreview(file, chatMessages[0])}
                      className="text-blue-600 cursor-pointer hover:scale-110 transition-transform duration-400 rounded-full p-1 h-7 w-7 bg-gray-200 flex justify-center items-center hover:text-blue-800"
                      aria-label={`View ${file.name}`}
                      title="View full file"
                    >
                      <FiZoomIn size={15} />
                    </div>
                    <div
                      onClick={() => handleDownloadFile(file.url, file.name)}
                      className="text-blue-600 cursor-pointer hover:scale-110 transition-transform duration-400 rounded-full p-1 h-7 w-7 bg-gray-200 flex justify-center items-center hover:text-blue-800"
                      aria-label={`Download ${file.name}`}
                      title="Download"
                    >
                      <FiDownload size={15} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {isModalOpen && selectedFile && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex z-50 transition-all duration-300"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-gray-50 mx-10 shadow-2xl overflow-hidden relative flex flex-col transition-all duration-500 ease-out"
            style={{
              marginTop: "20px",
              width: "calc(100% - 20px)",
              height: "calc(100% - 20px)",
              borderTopLeftRadius: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Clean, Minimal, Professional */}
            <div className="flex justify-between items-center px-8 py-10 bg-white border-b border-gray-100 shadow-sm z-10">
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

                <div className="h-8 w-[1px] bg-gray-200 mx-2" />

                <div
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 cursor-pointer bg-gray-300 text-black hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  aria-label="Close"
                >
                  <FiX size={24} />
                </div>
              </div>
            </div>

            {/* Main Preview Area: Maximized for PDF visibility */}
            <div className="flex-1 bg-slate-200/50 p-4 md:p-8 overflow-y-auto flex justify-center">
              <div className="w-full max-w-5xl h-full shadow-2xl bg-white rounded-sm overflow-hidden border border-gray-300">
                {/* renderPreview(selectedFile) should ideally return an <iframe> or <object> 
            with width="100%" and height="100%" for the perfect PDF view.
          */}
                {renderPreview(selectedFile)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ClientProjectInfo;