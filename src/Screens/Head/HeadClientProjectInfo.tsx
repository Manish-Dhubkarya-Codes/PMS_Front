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
  FaUser,
  FaBars,
  FaTimes,
  FaFileArchive,
  FaInfoCircle,
  FaEllipsisV,
  FaBolt,
} from "react-icons/fa";
import { FaFilePdf, FaFileWord } from "react-icons/fa6";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FiDownload, FiTrash2, FiX, FiZoomIn } from "react-icons/fi";
import { RiTimeLine } from "react-icons/ri";
import { TbListDetails } from "react-icons/tb";
import {
  serverURL,
  postData,
  getData,
} from "../../BackendConnections/FetchBackendServices";
import { IoCheckmarkDoneSharp } from "react-icons/io5";
import useSound from "use-sound";
import notificationSound from "../../../src/assets/CredientialAssets/Chat_Notification_Sound.mp3";
import { v4 as uuidv4 } from "uuid";
import { useSocket } from "../../BackendConnections/useSocket";
import Button2 from "../../UI_Components/Buttons/Button2";
import SOW from "../../UI_Components/Pop_Ups/SOW";
import { MdOutlineDoubleArrow, MdOutlineReply, MdEdit, MdDelete, MdBlock } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";
import ProgressTracking from "../../UI_Components/Progresses/ProgressTracking";
interface ReplyMessage {
  // New: For reply context
  id: number;
  sender: string; // e.g., "Client", "Team Leader"
  content: string; // Truncated original message or file name
  type: "text" | "file";
  timestamp: string;
}
interface ChatMessage {
  type: "text" | "file";
  isLeft: boolean;
  fromClient: boolean;
  fromHead: boolean;
  fromTeamLeader: boolean;
  message?: string;
  file?: { url: string; name: string; type: string; blob?: Blob };
  files?: { url: string; name: string; type?: string }[];
  timestamp: string;
  seen_by: string[];
  id?: number;
  mention?: {
    type: "client" | "head" | "tl";
    id: string;
    name: string;
    imageUrl?: string;
  } | null;
  tempId?: string;
  replyTo?: ReplyMessage | null;
  edited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  caption?: string;
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
  headName?: string;
  headPic?: string;
  teamLeaderName?: string;
  teamLeaderPic?: string;
  clientchats?: string[];
  clientaudios?: string[];
  headchats?: string[];
  headaudios?: string[];
  tlchats?: string[];
  tlaudios?: string[];
  teamleaderid?: string;
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
  type: "client" | "tl";
  id: string;
  name: string;
  imageUrl?: string;
}
interface Employee {
  employeeId: string;
  employeeName: string;
  employeeDesignation: string;
  employeeMail: string;
  employmentID: string;
  employeePic: string | null;
  role: string;
  status: string;
}
interface UpdateItem {
  number: number;
  title: string;
  messageTimestamp: string;
  isText: boolean;
}
const HeadClientProjectInfo: React.FC = () => {
  const [replyToMessage, setReplyToMessage] = useState<ReplyMessage | null>(
    null
  );
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [messageMenuIndex, setMessageMenuIndex] = useState<number | null>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [monitors, setMonitors] = useState<Employee[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [previewHeight, setPreviewHeight] = useState<number>(0);
  const [currentTab, setCurrentTab] = useState<"chat" | "files">("chat");
  const [newMessage, setNewMessage] = useState<string>("");
  const [updatesList, setUpdatesList] = useState<UpdateItem[]>([]);
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(
    null
  );
  const isCompleted = projectDetails?.status === "Completed";
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { item: locationItem } = location.state || {};
  const storedUserData = localStorage.getItem("userData");
  const parsedData = storedUserData ? JSON.parse(atob(storedUserData)) : null;
  const headId = parsedData?.headId || "";
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const autoScrollRef = useRef<boolean>(true);
  const prevMessagesLengthRef = useRef(0);
  const [msgControl, setMsgControl] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const { item } = location.state || {};
  const storedUserRole = localStorage.getItem("role")
    ? atob(localStorage.getItem("role")!)
    : "";
  const divRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [playNotification] = useSound(notificationSound);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const observer = useRef<IntersectionObserver | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmployeeMenu, setShowEmployeeMenu] = useState<string | null>(null);
  const [showPromotePopup, setShowPromotePopup] = useState(false);
  const [selectedEmployeeForPromote, setSelectedEmployeeForPromote] =
    useState<Employee | null>(null);
  const [securityKeyInput, setSecurityKeyInput] = useState("");
  const { socket, connected, onEvent, emitEvent } = useSocket();
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [showSOWModal, setShowSOWModal] = useState(false);
  const [sowFields, setSowFields] = useState<
    Array<{ title: string; content: string }>
  >([
    { title: "", content: "" },
    { title: "", content: "" },
  ]);

  const [progress, setProgress] = useState({ start: 'no', payment: '0%', work: '0%' });
  const localRole = "Head";

  const handleReplyToMessage = (msg: ChatMessage) => {
    const sender = msg.fromClient
      ? "Client"
      : msg.fromTeamLeader
      ? "Team Leader"
      : "Head";
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
console.log("Project Details:", projectDetails);
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

  const navigate = useNavigate();
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
  useEffect(() => {
    const fetchEmployeesAndMonitors = async () => {
      if (!projectDetails?.project_id) return;
      try {
        const response = await getData(
          `employees/fetch_employee_by_projectid/${projectDetails.project_id}`
        );
        if (response) {
          console.log("RESSSSSSS", response.data);
          const allEmps = response.data.employees || [];
          const monitorsFiltered = allEmps.filter(
            (e: Employee) => e.status === "Project Monitor"
          );
          const employeesFiltered = allEmps.filter(
            (e: Employee) => e.status !== "Project Monitor"
          );
          setEmployees(
            employeesFiltered.map((e: Employee) => ({ ...e, isMonitor: false }))
          );
          setMonitors(
            monitorsFiltered.map((m: Employee) => ({ ...m, isMonitor: true }))
          );
        }
      } catch (error) {
        console.error("Error fetching employees and monitors:", error);
      }
    };
    fetchEmployeesAndMonitors();
  }, [projectDetails?.project_id]);

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

  const processUpdates = (messages: ChatMessage[]) => {
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
    processUpdates(chatMessages);
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
    const fetchProjectById = async (projectId: string) => {
      setLoading(true);
      setFallbackLoading(true);
      try {
        const response = await getData(
          `clientproject/get_project/${projectId}`
        );
        if (response.status && response.data) {
          setProjectDetails(response.data);
          console.log("Fetched project data (fallback):", response.data);
        } else {
          console.error("Failed to fetch project:", response.message);
        }
      } catch (error) {
        console.error("Error fetching project data:", error);
      } finally {
        setLoading(false);
        setFallbackLoading(false);
      }
    };
    if (item?.project_id) {
      setProjectDetails(item as ProjectDetails);
      fetchProjectById(item.project_id);
    } else if (searchParams.get("projectId")) {
      const projectId = searchParams.get("projectId")!;
      console.log("SW fallback: Loading project from URL:", projectId);
      fetchProjectById(projectId);
    }
  }, [item, searchParams]);
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker
    .register("/sw.js")
    .catch(console.error);
}
    const handleNavigation = async () => {
      setLoading(true);
      setFallbackLoading(true);
      let fetchedItem = locationItem;
      if (fetchedItem?.project_id) {
        console.log("Loaded from location state:", fetchedItem.project_id);
        setProjectDetails(fetchedItem as ProjectDetails);
      } else if (searchParams.get("projectId")) {
        const projectId = searchParams.get("projectId")!;
        console.log("SW fallback: Loading project from URL:", projectId);
        const sendReady = () => {
          const controller = navigator.serviceWorker.controller;
          if (controller) {
            controller.postMessage({
              type: "readyForProject",
              projectId,
            });
            console.log("Sent readyForProject to SW for", projectId);
          } else {
            console.warn("SW controller not ready – retrying in 500ms");
            setTimeout(sendReady, 500);
          }
        };
        sendReady();
        try {
          const response = await getData(
            `clientproject/get_project/${projectId}`
          );
          if (response.status && response.data) {
            fetchedItem = response.data;
            setProjectDetails(response.data);
            console.log("Fetched project data (fallback):", response.data);
          } else {
            console.error("Failed to fetch project:", response.message);
          }
        } catch (error) {
          console.error("Error fetching project data:", error);
        }
      }
      setLoading(false);
      setFallbackLoading(false);
      const handleSWMessage = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin ||
          event.data.type !== "navigateToProject"
        )
          return;
        const { item } = event.data;
        console.log("Received full item from SW:", item?.project_id);
        if (item?.project_id) {
          setProjectDetails(item as ProjectDetails);
          navigate(`/headclientprojectinfo`, {
            state: { item },
            replace: true,
          });
        }
      };
      window.addEventListener("message", handleSWMessage);
      return () => window.removeEventListener("message", handleSWMessage);
    };
    handleNavigation();
  }, [locationItem, searchParams, headId]);
  useEffect(() => {
    if (socket && connected && projectDetails?.project_id) {
      socket.emit("joinProject", projectDetails.project_id);
    }
  }, [socket, connected, projectDetails?.project_id]);

  useEffect(() => {
    if (socket) {
      onEvent("newMessage", (data: { fromRole: string; msg: any }) => {
        const { fromRole, msg: incoming } = data;
        setChatMessages((prev) => {
          const isDuplicate = prev.some(
            (m) =>
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
              caption: updated[existingIndex].caption || incoming.caption || undefined,
              tempId: undefined,
            };
            return updated.sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            );
          } else {
            const fromClient = fromRole === "client";
            const fromHead = fromRole === "head";
            const fromTeamLeader = fromRole === "tl";
            const isLeft = fromClient || fromTeamLeader;
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
              replyTo: incoming.replyTo
                ? {
                    // New: Parse replyTo from socket data
                    id: incoming.replyTo.id,
                    sender: incoming.replyTo.sender,
                    content: incoming.replyTo.content,
                    type: incoming.replyTo.type,
                    timestamp: incoming.replyTo.timestamp,
                  }
                : null,
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
    onEvent("messageSeen", (data) => {
      console.log("Received messageSeen data:", data);
      let fromClient = false;
      let fromHead = false;
      let fromTeamLeader = false;
      let index = data.index;
      let seen_by = data.seen_by;
      let timestamp = data.timestamp;
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
        const targetMessage = prev.find(
          (m) =>
            (m.id === index || m.timestamp === timestamp) &&
            m.fromClient === fromClient &&
            m.fromHead === fromHead &&
            m.fromTeamLeader === fromTeamLeader
        );
        if (!targetMessage) {
          console.log("No matching message found for update");
          return prev;
        }
        const updated = prev.map((m) =>
          (m.id === index || m.timestamp === timestamp) &&
          m.fromClient === fromClient &&
          m.fromHead === fromHead &&
          m.fromTeamLeader === fromTeamLeader
            ? { ...m, seen_by }
            : m
        );
        console.log(
          "Updated seen_by for message:",
          updated.find(
            (m) =>
              (m.id === index || m.timestamp === timestamp) &&
              m.fromClient === fromClient &&
              m.fromHead === fromHead &&
              m.fromTeamLeader === fromTeamLeader
          )?.seen_by
        );
        return updated;
      });
    });
  }, [onEvent]);
  useEffect(() => {
    if (projectDetails?.project_id && connected) {
      emitEvent("joinProject", projectDetails.project_id);
      console.log(`Joined project room: project_${projectDetails.project_id}`);
    }
    return () => {
      if (projectDetails?.project_id) {
        emitEvent("leaveProject", projectDetails.project_id);
      }
    };
  }, [projectDetails?.project_id, connected, emitEvent]);
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
      if (
        projectDetails.clientaudios &&
        i < projectDetails.clientaudios.length
      ) {
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
            isLeft: false,
            fromClient: false,
            fromHead: true,
            fromTeamLeader: false,
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
            isLeft: false,
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
            isLeft: true,
            fromClient: false,
            fromHead: false,
            fromTeamLeader: true,
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
          console.error("Error parsing TL chat:", e);
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
            isLeft: true,
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
          console.error("Error parsing TL audio:", e);
        }
      }
    }
    allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setChatMessages(allMessages);
    processUpdates(allMessages);
  }, [projectDetails]);
  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const idx = target.dataset.idx;
            if (idx) {
              const msg = chatMessages[parseInt(idx)];
              const viewer = "head";
              if (
                msg &&
                msg.isLeft &&
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
  }, [chatMessages, storedUserRole, projectDetails?.project_id]);
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

  const handleSubmitSOW = async () => {
    setLoading(true);

    try {
      let htmlContent = `
    <div style="font-family: 'Helvetica', 'Arial', sans-serif; color: #1a1a1a; padding: 50px; line-height: 1.8; background-color: #ffffff;">

      <!-- Accent Bar -->
      <div style="background-color: #3b82f6; height: 8px; width: 140px; margin-bottom: 25px;"></div>

      <!-- Title -->
      <h1 style="font-size: 28px; margin-bottom: 8px; color: #111;">
        Statement of Work
      </h1>
      <h2 style="font-size: 20px; font-weight: 400; color: #3b82f6; margin-top: 0;">
        ${projectDetails?.title || "Untitled Project"}
      </h2>

      <!-- Meta -->
      <div style="display: flex; margin: 40px 0; padding: 25px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
        <div style="flex: 1;">
          <span style="display: block; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px;">
            Project Name
          </span>
          <span style="font-weight: 600;">
            ${projectDetails?.title || "N/A"}
          </span>
        </div>
        <div style="flex: 1;">
          <span style="display: block; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px;">
            Date
          </span>
          <span style="font-weight: 600;">
            ${new Date().toLocaleDateString("en-GB")}
          </span>
        </div>
      </div>

      <!-- Scope -->
      <div style="margin-top: 20px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #444; margin-bottom: 30px; border-left: 4px solid #3b82f6; padding-left: 15px;">
          Scope of Work
        </h3>
    `;

      sowFields.forEach((field, index) => {
        if (field.title && field.content) {
          htmlContent += `
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h4 style="font-size: 18px; color: #111; margin-bottom: 12px; font-weight: 600;">
            ${index + 1}. ${field.title}
          </h4>
          <div style="font-size: 16px; color: #333; letter-spacing: 0.2px;">
            ${field.content
              .split("\n")
              .map((p) => `<p style="margin-bottom: 18px;">${p}</p>`)
              .join("")}
          </div>
        </div>
        `;
        }
      });

      htmlContent += `
      </div>

      <!-- Footer -->
      <div style="margin-top: 80px; border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
        <p style="font-size: 11px; color: #aaa;">
          Document End — Statement of Work
        </p>
      </div>

    </div>
    `;

      const sanitizedHtml = DOMPurify.sanitize(htmlContent);

      const blob = await generatePdfBlob(
        sanitizedHtml      );

      const fileName = `@SOW_${(projectDetails?.title || "untitled")
        .replace(/\s+/g, "_")
        .toLowerCase()}.pdf`;

      const file = new File([blob], fileName, {
        type: "application/pdf",
      });

      const tempUrl = URL.createObjectURL(file);

      handleSendMessage("", "file", [
        {
          url: tempUrl,
          name: file.name,
          type: file.type,
          blob: file,
        },
      ]);

      setShowSOWModal(false);
      setSowFields([
        { title: "", content: "" },
        { title: "", content: "" },
      ]);
    } catch (error) {
      console.error("Error generating or sending SOW:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeenText = (msg: ChatMessage) => {
    if (msg.seen_by.length === 0) return "Not seen yet";
    let text = "Seen by ";
    if (msg.seen_by.includes("client"))
      text += `Client (${
        projectDetails?.clientName || item?.clientName || "Client"
      }), `;
    if (msg.seen_by.includes("tl"))
      text += `Team Leader (${
        projectDetails?.teamLeaderName || item?.teamLeaderName || "TL"
      })`;
    if (text.endsWith(", ")) text = text.slice(0, -2);
    return text;
  };
  const isAllSeen = (msg: ChatMessage) => {
    return msg.seen_by.includes("client") && msg.seen_by.includes("tl");
  };
  const requiresPreview = (msg: ChatMessage) => {
    if (msg.type === "text") return false;
    if (!msg.file?.type) return false;
    const ft = msg.file.type;
    if (ft.startsWith("audio/") || ft.startsWith("video/")) return false;
    return true;
  };
  const markMessageAsSeen = async (msg: ChatMessage) => {
    if (!projectDetails?.project_id || msg.id === undefined) return;
    let messageType =
      msg.type === "file" && msg.file?.type.startsWith("audio/")
        ? "audio"
        : "chat";
    const viewer = "head";
    try {
      const response = await postData(
        `clientproject/mark_message_seen/${projectDetails.project_id}`,
        {
          index: msg.id,
          fromClient: msg.fromClient,
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
              m.fromClient === msg.fromClient &&
              m.fromHead === msg.fromHead &&
              m.fromTeamLeader === msg.fromTeamLeader) ||
            (m.timestamp === msg.timestamp &&
              m.fromClient === msg.fromClient &&
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
  let displayedMessages = chatMessages;
  if (currentTab === "files") {
    displayedMessages = chatMessages.filter((msg) => msg.type === "file");
  }
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
      return date.toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
    }
  };

  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const highlightMessageText = (
    text: string,
    mention: ChatMessage["mention"]
  ) => {
    if (!text) return text;

    let highlighted = text;

    if (projectDetails?.clientName || item?.clientName) {
      const clientMentionStr = `@${
        projectDetails?.clientName || item?.clientName
      }`;
      highlighted = highlighted.replace(
        new RegExp(escapeRegExp(clientMentionStr), "gi"),
        `<span style="color: #2934E3; font-weight: 500;">${clientMentionStr}</span>`
      );
    }

    if (projectDetails?.teamLeaderName || item?.teamLeaderName) {
      const tlMentionStr = `@${
        projectDetails?.teamLeaderName || item?.teamLeaderName
      }`;
      highlighted = highlighted.replace(
        new RegExp(escapeRegExp(tlMentionStr), "gi"),
        `<span style="color: #2934E3; font-weight: 500;">${tlMentionStr}</span>`
      );
    }

    if (projectDetails?.headName || parsedData?.headName) {
      const headMentionStr = `@${
        projectDetails?.headName || parsedData?.headName
      }`;
      highlighted = highlighted.replace(
        new RegExp(escapeRegExp(headMentionStr), "gi"),
        `<span style="color: #2934E3; font-weight: 500;">${headMentionStr}</span>`
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

  const getSenderInfo = (msg: ChatMessage) => {
    if (msg.fromClient) {
      return {
        role: "Client",
        name: projectDetails?.clientName || item?.clientName,
      };
    } else if (msg.fromHead) {
      return { role: "Head", name: "You" };
    } else if (msg.fromTeamLeader) {
      return {
        role: "Team Leader",
        name: projectDetails?.teamLeaderName || item?.teamLeaderName,
      };
    }
    return { role: "Unknown", name: "Unknown" };
  };
  const detectMention = (message: string): ChatMessage["mention"] | null => {
    const mentionMatch = message.match(/@(\S+)/i);
    if (!mentionMatch) return null;
    const mentionText = mentionMatch[1].trim();
    const clientNameTrimmed = (
      projectDetails?.clientName ||
      item?.clientName ||
      ""
    )
      .trim()
      .toLowerCase();
    const tlNameTrimmed = (
      projectDetails?.teamLeaderName ||
      item?.teamLeaderName ||
      ""
    )
      .trim()
      .toLowerCase();
    if (mentionText.toLowerCase() === clientNameTrimmed) {
      return {
        type: "client",
        id: (projectDetails?.clientid || item?.clientid || "").toString(),
        name: projectDetails?.clientName || item?.clientName || "",
      };
    } else if (mentionText.toLowerCase() === tlNameTrimmed) {
      return {
        type: "tl",
        id: (
          projectDetails?.teamleaderid ||
          item?.teamleaderid ||
          ""
        ).toString(),
        name: projectDetails?.teamLeaderName || item?.teamLeaderName || "",
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
      const mentionMatch = before.match(/@(\w+(?:\s\w+)?)\s?$/);
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
    ...(projectDetails?.clientName || item?.clientName
      ? [
          {
            label: `Client: ${projectDetails?.clientName || item?.clientName}`,
            value: `@${projectDetails?.clientName || item?.clientName}`,
            type: "client" as const,
            id: (projectDetails?.clientid || item?.clientid || "").toString(),
            name: projectDetails?.clientName || item?.clientName || "",
            imageUrl:
              projectDetails?.clientPic || item?.clientPic
                ? `${serverURL}/files/${
                    projectDetails?.clientPic || item?.clientPic
                  }`
                : UserIcon,
          },
        ]
      : []),
    ...(projectDetails?.teamLeaderName || item?.teamLeaderName
      ? [
          {
            label: `Team Leader: ${
              projectDetails?.teamLeaderName || item?.teamLeaderName
            }`,
            value: `@${projectDetails?.teamLeaderName || item?.teamLeaderName}`,
            type: "tl" as const,
            id: (
              projectDetails?.teamleaderid ||
              item?.teamleaderid ||
              ""
            ).toString(),
            name: projectDetails?.teamLeaderName || item?.teamLeaderName || "",
            imageUrl:
              projectDetails?.teamLeaderPic || item?.teamLeaderPic
                ? `${serverURL}/files/${
                    projectDetails?.teamLeaderPic || item?.teamLeaderPic
                  }`
                : UserIcon,
          },
        ]
      : []),
  ];
const handleSendMessage = async (
  message: string,
  type: "text" | "voice" | "file" = "text",
  files?: { name: string; url: string; type: string; blob?: Blob }[],
  caption?: string   // ← NEW: caption from MikeSearch (text + file)
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
      const headId = parsedData?.headId || "default_head_id";

      // Get current reply context (if user is replying to a message)
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
          fromHead: true,
          fromTeamLeader: false,
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

        socket.emit("sendHeadMessage", {
          projectId: projId,
          type: "text",
          msgData: message,
          timestamp,
          headId,
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
              fromHead: true,
              fromTeamLeader: false,
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

            socket.emit("sendHeadMessage", {
              projectId: projId,
              type: "audio",
              msgData: {
                name: file.name,
                url,
                type: file.type || "audio/mp3",
              },
              timestamp,
              headId,
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
                  caption: caption || message.trim() || undefined,   // ← Caption support (priority to new param)
                  isLeft: false,
                  fromClient: false,
                  fromHead: true,
                  fromTeamLeader: false,
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

                socket.emit("sendHeadMessage", {
                  projectId: projId,
                  type: "file",
                  msgData: { name: file.name, url, type: file.type },
                  caption: caption || message.trim() || null,   // ← Send caption to backend
                  timestamp,
                  headId,
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
  // In HeadClientProjectInfo.tsx

  const handleClickOnReplyBubble = (reply: ReplyMessage) => {
    const originalMsg = chatMessages.find(
      (m) =>
        m.timestamp === reply.timestamp &&
        ((reply.sender === "Client" && m.fromClient) ||
          (reply.sender === "Team Leader" && m.fromTeamLeader) ||
          (reply.sender === "Head" && m.fromHead))
    );
    if (originalMsg) {
      const index = chatMessages.indexOf(originalMsg);
      const el = messageRefs.current[`${index}`];
      if (el && chatContainerRef.current) {
        el.scrollIntoView({ block: "center" });

        // Apply highlight instantly without transition
        el.style.transition = "none";
        el.style.backgroundColor = "#636363";
        el.offsetHeight; // Force reflow to apply styles immediately

        // After 1 second, fade out slowly over 2 seconds
        setTimeout(() => {
          el.style.transition = "background-color 3s ease-out";
          el.style.backgroundColor = "transparent"; // Or set to your original background color, e.g., "#ffffff" if it's white
        }, 1000);
      }
    }
  };

  // Head edit/delete socket listeners
  useEffect(() => {
    if (!socket) return;
    const handleEdited = (data: { projectId: string; index: number; newData: string; editedAt: string }) => {
      if (data.projectId !== projectDetails?.project_id) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === data.index && m.fromHead
            ? { ...m, message: data.newData, edited: true, editedAt: data.editedAt }
            : m
        )
      );
    };
    const handleDeleted = (data: { projectId: string; index: number; deletedAt: string }) => {
      if (data.projectId !== projectDetails?.project_id) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === data.index && m.fromHead
            ? { ...m, isDeleted: true, deletedAt: data.deletedAt, message: undefined, file: undefined }
            : m
        )
      );
    };
    socket.on("headMessageEdited", handleEdited);
    socket.on("headMessageDeleted", handleDeleted);
    return () => {
      socket.off("headMessageEdited", handleEdited);
      socket.off("headMessageDeleted", handleDeleted);
    };
  }, [socket, projectDetails?.project_id]);

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
        m.timestamp === msg.timestamp && m.fromHead
          ? { ...m, isDeleted: true, deletedAt: timestamp, message: undefined, file: undefined }
          : m
      )
    );
    if (socket && connected && projectDetails?.project_id && msg.id !== undefined) {
      socket.emit("deleteHeadMessage", {
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
        m.timestamp === editingMessage.timestamp && m.fromHead
          ? { ...m, message: newMessage.trim(), edited: true, editedAt }
          : m
      )
    );
    socket.emit("editHeadMessage", {
      projectId: projectDetails.project_id,
      index: editingMessage.id,
      newData: newMessage.trim(),
      editedAt,
    });
    setEditingMessage(null);
    setNewMessage("");
  };
  const handleOpenPreview = (file: File | undefined, msg: ChatMessage) => {
    if (file) {
      setSelectedFile(file);
      setIsModalOpen(true);
      const isReceived = msg.isLeft;
      const viewer = "head";
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
    if (isDrawerOpen || isModalOpen || showSOWModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen, isModalOpen, showSOWModal]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmployeeMenu &&
        !(event.target as HTMLElement).closest(".employee-menu")
      ) {
        setShowEmployeeMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmployeeMenu]);
  const handlePromoteToTeamLeader = async () => {
    if (!selectedEmployeeForPromote || !securityKeyInput.trim()) {
      console.error("Security Key is required.");
      return;
    }
    try {
      const response = await postData("employees/change_employees_role", {
        employeeId: selectedEmployeeForPromote.employeeId,
        role: "Team Leader",
        securityKey: securityKeyInput.trim(),
      });
      if (response) {
        const empIndex = employees.findIndex(
          (emp) => emp.employeeId === selectedEmployeeForPromote.employeeId
        );
        if (empIndex !== -1) {
          setEmployees((prev) => prev.filter((_, i) => i !== empIndex));
          console.log("helloooo");
        }
        setShowPromotePopup(false);
        setSelectedEmployeeForPromote(null);
        setSecurityKeyInput("");
        setShowEmployeeMenu(null);
      } else {
        console.error("Failed to promote to Team Leader.");
      }
    } catch (err) {
      console.error("Promote Error:", err);
    }
  };
  const generateKey = () => {
    const randomKey = Math.random().toString(36).substring(2, 10).toUpperCase();
    setSecurityKeyInput(randomKey);
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
  return (
    <div>
      <div
        className={`flex flex-col w-full text-black ${
          isLG
            ? "px-16 py-20 overflow-y-auto min-h-screen justify-center"
            : isXL || is2XL
            ? "px-24 min-h-screen overflow-y-auto py-20 justify-center"
            : "px-4 py-26"
        } items-center relative`}
      >
        <MainNavigation isMenuHide={false} />
        {fallbackLoading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>{" "}
              {/* Simple spinner */}
              <p className="text-gray-600">
                Loading project from notification...
              </p>
            </div>
          </div>
        )}
        <div className="w-full md:gap-x-5 items-start flex mb-8 flex-row">
          <div>
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
      // No onStepClick for Head (view-only)
    />
  </div>
            ) : null}
          </div>
          <div className=" flex md:gap-y-0 gap-y-10 md:flex-row flex-col w-full gap-x-15">
            <div className="md:w-[50%] w-full flex flex-col gap-y-5">
              <div className="flex items-start flex-col">
                <div className="mb-4">
                  <Button1
                    value={projectDetails?.workstream || item?.workstream || ""}
                    gradientType="gradient1"
                  />
                </div>
                <div className="leading-relaxed flex items-start flex-col">
                  <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                    {projectDetails?.clientName ||
                      item?.clientName ||
                      "Unknown Client"}
                  </div>
                  <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                    Project ID:{" "}
                    <span className="font-semibold">
                      {projectDetails?.project_id || item?.project_id || "N/A"}
                    </span>
                  </div>
                  <div className={`${is2XL ? "text-sm" : "text-xs"}`}>
                    Submission Date:{" "}
                    <span>
  {new Date(
    projectDetails?.deadline || item?.deadline || ""
  ).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}
</span>
                  </div>
                  <div className={`mt-2 ${is2XL ? "text-sm" : "text-xs"}`}>
                    Budget:{" "}
                    <span className="font-semibold">
                      ₹{projectDetails?.budget || item?.budget || "N/A"}
                    </span>
                  </div>
                </div>
                {/* SOW */}
                <div className="flex justify-center mt-5">
                  <Button2
                    value="Create SOW"
                    onClick={() => setShowSOWModal(true)}
                    disabled={isCompleted || !projectDetails?.project_id}
                  />
                </div>
              </div>
              <div className="w-full text-start rounded-xl border border-gray-200 flex flex-col items-start max-h-[550px] overflow-auto p-6 shadow-sm">
                <div className="text-[15px] text-[#0587F5] mb-2 flex items-center gap-x-1.5 font-semibold">
                  <span>
                    <TbListDetails />
                  </span>
                  Project Details
                </div>
                {loading || fallbackLoading || !projectDetails ? (
                  <div className="flex items-center justify-center w-full h-[200px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="ml-2 text-gray-600">Loading...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start flex-col border-b border-black w-full pb-4 mb-4">
                      <span className="inline-block bg-red-200 rounded-full px-3 py-1 text-xs font-semibold text-blue-800">
                        {projectDetails?.workstream ||
                          item?.workstream ||
                          "N/A"}
                      </span>
                      <h3 className="mt-2 text-[12px] font-bold text-gray-900">
                        {projectDetails?.title || item?.title || "N/A"}
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

                          if (Array.isArray(projectDetails?.description)) {
                            initialDesc = projectDetails.description[0] || "";
                          } else {
                            initialDesc = projectDetails?.description || "";
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
                        <div className="flex flex-col w-full space-y-3 sm:flex-row sm:justify-between sm:space-y-0">
                          <div className="flex items-center gap-x-1 text-gray-500">
                            <RiTimeLine size={15} color="#FF0A78" />
                            <span className="font-semibold text-gray-800">
                              {new Date(
                                projectDetails?.deadline || item?.deadline || ""
                              ).toLocaleDateString("en-GB")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Chatbox */}
            <div
              className={`
  md:w-1/2 w-full md:min-h-[400px] min-h-[300px]
  md:max-h-[650px] max-h-[550px]
  flex flex-col items-center justify-between pb-10
  ${isCompleted ? 'bg-[#dddddd]' : 'bg-gradient-to-t from-[#f0f9fd] to-[#CFE3FF]'}
  ring-1 ring-inset ring-cyan-100/50
  text-slate-500
  shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)]
  shadow-[#8A8A8A]
  rounded-[10px]
`}
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
                <div
                  ref={chatContainerRef}
                  className={`w-full px-4 rounded-md ${
                    is2XL ? "text-sm" : "text-xs"
                  } overflow-y-auto thin-scroll space-y-3 `}
                  style={{
                    paddingTop: "16px",
                    paddingBottom: previewHeight > 0 ? previewHeight + 20 : 30,
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
                                <img
                                  src={`${serverURL}/files/${
                                    msg.fromClient
                                      ? projectDetails?.clientPic ||
                                        item?.clientPic
                                      : msg.fromHead
                                      ? projectDetails?.headPic ||
                                        parsedData?.headPic
                                      : projectDetails?.teamLeaderPic ||
                                        item?.teamLeaderPic
                                  }`}
                                  alt="Profile"
                                  className="w-full h-full rounded-full border-2 border-blue-500/50"
                                  onError={(e) => {
                                    e.currentTarget.src = UserIcon;
                                  }}
                                />
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
                                        {msg.replyTo.sender === localRole
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
                                                msg.message,
                                                msg.mention
                                              )
                                            ),
                                          }}
                                        />
                                      )}
                                    </>
                                  )}
{msg.type === "file" &&
  msg.file?.url &&
  msg.file.name &&
  !msg.isDeleted && (
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

                                  {msg.files &&
                                    msg.files.length > 0 &&
                                    msg.files.map((file, i) => (
                                      <div
                                        key={i}
                                        className="mt-3 bg-white/70 backdrop-blur-md rounded-xl shadow-md overflow-hidden border border-gray-200"
                                      >
                                        {file.url && file.name ? (
                                          <>
                                            <div className="flex items-center gap-2 px-3 py-2">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                                                <FaRegFileAlt />
                                              </div>
                                              <a
                                                href={
                                                  file.url.startsWith("blob:")
                                                    ? file.url
                                                    : `${serverURL}${file.url}`
                                                }
                                                download={file.name}
                                                className={`text-blue-700 font-medium truncate ${
                                                  isSM || isXS || isXXS
                                                    ? "w-[70%]"
                                                    : "w-[80%]"
                                                }`}
                                              >
                                                {file.name}
                                              </a>
                                            </div>
                                            <div className="flex justify-between border-t border-gray-200 bg-white/60 px-3 py-2">
                                              {!msg.isLeft  && !isCompleted && (
                                                <button
                                                  onClick={() =>
                                                    handleDeleteMessage(msg)
                                                  }
                                                  className="text-red-500 hover:text-red-700 hover:shadow-[0_0_6px_rgba(255,0,0,0.5)] p-2 rounded-full transition-all"
                                                >
                                                  <FiTrash2 size={16} />
                                                </button>
                                              )}
                                              <div className="flex space-x-2">
                                                <div
                                                  onClick={() =>
                                                    handleOpenPreview(
                                                      {
                                                        url: file.url.startsWith(
                                                          "blob:"
                                                        )
                                                          ? file.url
                                                          : `${serverURL}${file.url}`,
                                                        name: file.name,
                                                        type:
                                                          file.type ||
                                                          "application/octet-stream",
                                                      },
                                                      msg
                                                    )
                                                  }
                                                  className="text-blue-600 hover:text-blue-800 hover:shadow-[0_0_6px_rgba(0,0,255,0.4)] p-2 rounded-full transition-all"
                                                >
                                                  <FiZoomIn size={16} />
                                                </div>
                                                <button
                                                  onClick={() =>
                                                    handleDownloadFile(
                                                      file.url.startsWith(
                                                        "blob:"
                                                      )
                                                        ? file.url
                                                        : `${serverURL}${file.url}`,
                                                      file.name
                                                    )
                                                  }
                                                  className="text-blue-600 hover:text-blue-800 hover:shadow-[0_0_6px_rgba(0,0,255,0.4)] p-2 rounded-full transition-all"
                                                >
                                                  <FiDownload size={16} />
                                                </button>
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="text-red-600 text-xs p-2">
                                            Invalid file data
                                          </div>
                                        )}
                                      </div>
                                    ))}

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
                                    {!msg.isLeft && (
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
                          <img
                            src={`${serverURL}/files/${parsedData?.headPic}`}
                            alt="Profile"
                            className="w-10 h-8 rounded-full border-2 border-blue-500/50"
                            onError={(e) => {
                              e.currentTarget.src = UserIcon;
                            }}
                          />
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
            {/* -- */}
          </div>
        </div>
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
      // No onStepClick for Head (view-only)
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
          <div className="w-full flex flex-col space-y-7">
            <div
              className={`w-full grid ${
                isLG || isXL || is2XL
                  ? "grid-cols-2 gap-16"
                  : "grid-cols-1 gap-4"
              }`}
            ></div>
            <div
              className={`${
                isLG || isXL || is2XL ? "flex-row" : "flex-col space-y-7 mt-7"
              } flex w-full justify-between`}
            >
              <div
                ref={descriptionRef}
                className="space-y-7 w-[95%] ml-[5%] flex flex-col items-start"
              >
                <div className="text-[14px] w-full text-start font-medium">
                  {employees.length + monitors.length > 0
                    ? "Employees Working"
                    : "No Employee Working"}
                </div>
                <div
                  className={`flex gap-x-7 gap-y-5 w-full thin-scroll ${
                    is2XL || isXL
                      ? "max-w-[600px]"
                      : isLG
                      ? "max-w-[500px]"
                      : "max-w-[80vw]"
                  }`}
                >
                  {(() => {
                    const allWorkers = [...monitors, ...employees];
                    return allWorkers.length > 0 ? (
                      allWorkers.map((emp) => (
                        <div
                          key={emp.employeeId}
                          className={`flex ${
                            isXS || isSM || isMD ? "w-[80px]" : "w-[100px]"
                          } items-center flex-col relative`}
                        >
                          <div
                            className={`${
                              emp.employeePic ? "p-1" : "p-4"
                            } relative z-10 rounded-full w-fit bg-white border-2 border-gray-400`}
                          >
                            {emp.employeePic ? (
                              <img
                                src={`${serverURL}/files/${emp.employeePic}`}
                                style={{
                                  width: isXS
                                    ? 30
                                    : isSM
                                    ? 40
                                    : isMD
                                    ? 50
                                    : isLG
                                    ? 60
                                    : isXL
                                    ? 70
                                    : is2XL
                                    ? 50
                                    : 25,
                                  height: isXS
                                    ? 30
                                    : isSM
                                    ? 40
                                    : isMD
                                    ? 50
                                    : isLG
                                    ? 60
                                    : isXL
                                    ? 70
                                    : is2XL
                                    ? 50
                                    : 25,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                                alt="Employee"
                              />
                            ) : (
                              <FaUser
                                size={
                                  isXS
                                    ? 25
                                    : isSM
                                    ? 30
                                    : isMD
                                    ? 35
                                    : isLG
                                    ? 40
                                    : isXL
                                    ? 45
                                    : is2XL
                                    ? 50
                                    : 20
                                }
                                color="#9e9e9e"
                              />
                            )}
                          </div>
                          <div className="text-center">
                            <div className="text-[12px]">
                              {emp.employeeName}
                            </div>
                            <div className="font-medium text-[12px]">
                              {(emp as Employee & { isMonitor?: any }).isMonitor
                                ? "Monitor"
                                : "Employee"}
                            </div>
                          </div>
                         {!isCompleted && (
    <div className="absolute top-0 right-0 z-20">
      <FaEllipsisV
        size={14}
        className="text-gray-500 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setShowEmployeeMenu((prev) =>
            prev === emp.employeeId
              ? null
              : emp.employeeId
          );
        }}
      />
    </div>
  )}
  {showEmployeeMenu === emp.employeeId && !isCompleted && (
    <div className="employee-menu cursor-pointer absolute top-5 -right-30 bg-white border border-gray-300 rounded-tl-none rounded-md shadow-lg z-50 min-w-[150px]">
      <div
        onClick={() => {
          setSelectedEmployeeForPromote(
            emp as Employee
          );
          setShowEmployeeMenu(null);
          setShowPromotePopup(true);
        }}
        className="block w-full text-left px-4 py-2 text-[12px] text-gray-700 "
      >
        Promote to Team Leader
      </div>
    </div>
  )}
                        </div>
                      ))
                    ) : (
                      <></>
                    );
                  })()}
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

        {/* Glassy Minimalistic Popup for Promoting Employee to Team Leader */}
        {showPromotePopup && selectedEmployeeForPromote && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-white/20 rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Promote to Team Leader
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Employee: {selectedEmployeeForPromote.employeeName}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Security Key:
                </label>
                <div className="w-full mb-2 p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
                  <div className="relative">
                    <input
                      type="text"
                      value={securityKeyInput}
                      onChange={(e) => setSecurityKeyInput(e.target.value)}
                      placeholder="Enter security key"
                      className="w-full px-4 py-1 pr-10 text-[12px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
                      required
                    />
                    {/* Button inside input (right side) */}
                    <div
                      onClick={generateKey}
                      className="absolute inset-y-0 right-2 flex rounded-full hover:scale-90 cursor-pointer bg-gray-200 p-1.5 items-center text-blue-600 hover:text-blue-800"
                    >
                      <FaBolt size={14} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <div
                  onClick={() => {
                    setShowPromotePopup(false);
                    setSelectedEmployeeForPromote(null);
                    setSecurityKeyInput("");
                  }}
                  className="
                  w-full cursor-pointer
                  hover:scale-80
                  duration-300
                  bg-red-300
                  rounded-lg
                  py-1.5
                  text-sm
                  font-semibold
                  transition-transform
                "
                >
                  Cancel
                </div>
                <div
                  onClick={handlePromoteToTeamLeader}
                  className="
                  w-full cursor-pointer
                  hover:scale-80
                  duration-300
                  bg-green-300
                  rounded-lg
                  py-1.5
                  text-sm
                  font-semibold
                  transition-transform
                "
                >
                  Promote
                </div>
              </div>
            </div>
          </div>
        )}
        <div></div>
        {/* SOW */}
        {showSOWModal && projectDetails?.project_id && (
          <SOW
            showSOWModal={showSOWModal}
            onClose={() => {
              setShowSOWModal(false);
              setSowFields([
                { title: "", content: "" },
                { title: "", content: "" },
              ]);
            }}
            projectTitle={projectDetails.title || "Untitled Project"}
            projectId={projectDetails.project_id}
            sowFields={sowFields}
            onSowFieldsChange={setSowFields}
            loading={loading}
            onSubmit={handleSubmitSOW}
          />
        )}
      </div>
    </div>
  );
};
export default HeadClientProjectInfo;