import React, { useState, useRef, useEffect } from "react";
import { FiMic, FiTrash2, FiPlay, FiPause, FiX } from "react-icons/fi";
import { motion } from "framer-motion";
import {
  IoMdAttach,
  IoMdSend,
  IoIosArrowBack,
  IoIosLock,
  IoIosArrowUp,
  IoMdCloseCircle,
} from "react-icons/io";
import { TbShareplay } from "react-icons/tb";
import UserIcon from "../../assets/CredientialAssets/UserProfile.jpg";
import { FaFileArchive, FaFileInvoice, FaFileWord } from "react-icons/fa";
import { MdGridView, MdOutlineEditNote } from "react-icons/md";
import QuillEditor from "../../Screens/TextEditor";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { postData, serverURL } from "../../BackendConnections/FetchBackendServices";

interface MentionOption {
  label: string;
  value: string;
  type: any;
  id: string;
  name: string;
  imageUrl?: string;
}
interface ReplyMessage {
  id: string | number;
  sender: string;
  content: string;
  type: "text" | "file";
  timestamp: string;
}

interface MikeSearchProps {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
onSend?: (
  message: string,
  type: "text" | "voice" | "file",
  files?: { name: string; url: string; type: string; blob?: Blob }[],
  caption?: string   // ← NEW
) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  onPreviewHeightChange?: (height: number) => void;
  onFileUpload?: (files: File[]) => void;
  allowedFileTypes?: string[];
  inputRef?: React.RefObject<HTMLInputElement>;
  mentionOptions?: MentionOption[];
  onMentionSelect?: (option: MentionOption) => void;
  replyTo?: ReplyMessage | null;
  onCancelReply?: () => void;
  editingMessage?: { content: string } | null;
  onCancelEdit?: () => void;
  projectId?: string | null;
  isMonitorRestricted?: boolean;
  restrictionMessage?: string;
}
const MikeSearch: React.FC<MikeSearchProps> = ({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled,
  placeholder,
  onPreviewHeightChange,
  onFileUpload,
  allowedFileTypes = [
    "image/*",
    "video/*",
    "audio/*",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  inputRef,
  mentionOptions = [],
  onMentionSelect,
  replyTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  projectId,
  isMonitorRestricted = false,
  restrictionMessage = "Only the assigned Project Monitor can chat here",
}) => {

  

  const effectiveDisabled = disabled || isMonitorRestricted;
  const effectivePlaceholder = isMonitorRestricted
    ? restrictionMessage
    : placeholder;
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<string[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [barHeights, setBarHeights] = useState<number[]>(new Array(8).fill(8));
  // New states for instant recording
  const [isHolding, setIsHolding] = useState(false);
  const [isInstantRecording, setIsInstantRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showLockHint, setShowLockHint] = useState(false);
  const [showCancelHint, setShowCancelHint] = useState(false);
  const [showDeleteIcon, setShowDeleteIcon] = useState(false);
  const [micX, setMicX] = useState(0);
  const [micY, setMicY] = useState(0);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  // const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const isCancelRef = useRef(false);
  const autoSendRef = useRef(false);
  const recordingStartLockRef = useRef(false);
  /** Blocks double Enter / double click from firing onSend twice before state clears */
  const sendLockRef = useRef(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQuill, setShowQuill] = useState(false);
  const [quillContent, setQuillContent] = useState("");
  const [replyTitle, setReplyTitle] = useState("");
  const [isGeneratingText, setIsGeneratingText] = useState("Generate and Send");

  
  useEffect(() => {
    const previewOpen =
      selectedFiles.length > 0 ||
      isRecording ||
      !!audioBlob ||
      !!replyTo ||
      !!editingMessage;
    if (previewRef.current && previewOpen) {
      // mb-1.5 gap so the panel sits fully above the type bar
      const height = previewRef.current.offsetHeight + 6;
      onPreviewHeightChange?.(height);
    } else {
      onPreviewHeightChange?.(0);
    }
  }, [
    selectedFiles,
    isRecording,
    audioBlob,
    replyTo,
    editingMessage,
    onPreviewHeightChange,
  ]);
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);
  useEffect(() => {
    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (!analyserRef.current || !dataArrayRef.current || isPaused) return;
      if (audioContextRef.current?.state === "suspended") {
        void audioContextRef.current.resume();
      }
      const numBars = 8;
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      let energy = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        energy += dataArrayRef.current[i];
      }
      const newHeights: number[] = [];
      if (energy < 16) {
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        const slice = Math.floor(dataArrayRef.current.length / numBars) || 1;
        for (let i = 0; i < numBars; i++) {
          let peak = 0;
          for (let j = 0; j < slice; j++) {
            const sample = dataArrayRef.current[i * slice + j] ?? 128;
            const amp = Math.abs(sample - 128);
            if (amp > peak) peak = amp;
          }
          newHeights[i] = (peak / 128) * 80 + 6;
        }
      } else {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const barBinCount = Math.floor(bufferLength / numBars) || 1;
        for (let i = 0; i < numBars; i++) {
          let barSum = 0;
          for (let j = 0; j < barBinCount; j++) {
            const binIndex = i * barBinCount + j;
            if (binIndex < bufferLength) {
              barSum += dataArrayRef.current[binIndex];
            }
          }
          newHeights[i] = (barSum / barBinCount / 255) * 80 + 5;
        }
      }
      setBarHeights(newHeights);
    };
    if (isRecording && !isPaused) {
      rafId = requestAnimationFrame(animate);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isRecording, isPaused]);
  useEffect(() => {
    if (isPaused) {
      setBarHeights(new Array(8).fill(8));
    }
  }, [isPaused]);
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };
  const unlockAnalyserContext = async () => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AC();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
  };

  const connectAnalyser = async (stream: MediaStream) => {
    await unlockAnalyserContext();
    if (!audioContextRef.current) return;
    sourceRef.current?.disconnect();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    analyserRef.current.smoothingTimeConstant = 0.5;
    dataArrayRef.current = new Uint8Array(
      analyserRef.current.frequencyBinCount
    ) as Uint8Array<ArrayBuffer>;
    sourceRef.current.connect(analyserRef.current);
  };

  const startRecordingInternal = async () => {
    if (effectiveDisabled || selectedFiles.length || audioBlob) return;
    if (recordingStartLockRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      return;
    }
    recordingStartLockRef.current = true;
    setRecordingTime(0);
    setIsPaused(false);
    setBarHeights(new Array(8).fill(8));
    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      if (!mimeType && typeof MediaRecorder === "undefined") {
        console.error("No supported audio MIME type found");
        alert(
          "Your browser does not support any compatible audio formats for recording."
        );
        setIsRecording(false);
        recordingStartLockRef.current = false;
        return;
      }
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      isCancelRef.current = false;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        if (isCancelRef.current) {
          isCancelRef.current = false;
          chunksRef.current = [];
          setIsRecording(false);
          setIsInstantRecording(false);
          setIsHolding(false);
          setIsCanceling(false);
          setShowLockHint(false);
          setShowCancelHint(false);
          setShowDeleteIcon(false);
          setMicX(0);
          setMicY(0);
          setIsLocked(false);
          streamRef.current?.getTracks().forEach((track) => track.stop());
          if (audioContextRef.current) {
            await audioContextRef.current.close();
            audioContextRef.current = null;
          }
          sourceRef.current?.disconnect();
          analyserRef.current = null;
          dataArrayRef.current = null;
          sourceRef.current = null;
          return;
        }
        const blob = new Blob(chunksRef.current, {
          type: (mimeType || "audio/webm").split(";")[0],
        });
        chunksRef.current = [];
        if (blob.size === 0) {
          console.error("Audio blob is empty");
          alert("Failed to record audio. Please try again.");
          setIsRecording(false);
          setIsInstantRecording(false);
          setIsHolding(false);
          setIsCanceling(false);
          setShowLockHint(false);
          setShowCancelHint(false);
          setShowDeleteIcon(false);
          setMicX(0);
          setMicY(0);
          setIsLocked(false);
          streamRef.current?.getTracks().forEach((track) => track.stop());
          if (audioContextRef.current) {
            await audioContextRef.current.close();
            audioContextRef.current = null;
          }
          sourceRef.current?.disconnect();
          analyserRef.current = null;
          dataArrayRef.current = null;
          sourceRef.current = null;
          return;
        }
        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.add(url);
        if (!autoSendRef.current) {
          setAudioBlob(blob);
          setAudioUrl(url);
        } else {
          const cleanType = (mimeType || blob.type || "audio/webm").split(";")[0];
          const ext = cleanType.includes("mp4") ? "mp4" : "webm";
          onSend?.("", "voice", [
            {
              name: `recording_${Date.now()}.${ext}`,
              url: url,
              type: cleanType,
              blob: blob,
            },
          ]);
          autoSendRef.current = false;
          setIsSending(false);
        }
        setIsRecording(false);
        setIsPaused(false);
        setRecordingTime(0);
        setBarHeights(new Array(8).fill(8));
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }
        sourceRef.current?.disconnect();
        analyserRef.current = null;
        dataArrayRef.current = null;
        sourceRef.current = null;
        setIsInstantRecording(false);
        setIsHolding(false);
        setIsCanceling(false);
        setShowLockHint(false);
        setShowCancelHint(false);
        setShowDeleteIcon(false);
        setMicX(0);
        setMicY(0);
        setIsLocked(false);
      };
      mediaRecorder.start(200);
      await connectAnalyser(stream);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert(
        "Failed to access microphone. Please check permissions and try again."
      );
      setIsRecording(false);
      setIsInstantRecording(false);
      setIsHolding(false);
      setIsLocked(false);
    } finally {
      recordingStartLockRef.current = false;
    }
  };
  // New handlers for instant recording
  const handleMicPress = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    if (effectiveDisabled || selectedFiles.length || audioBlob) return;
    e.preventDefault();
    e.stopPropagation();
    if ("pointerId" in e && e.currentTarget instanceof HTMLElement) {
      try {
        e.currentTarget.setPointerCapture((e as React.PointerEvent).pointerId);
      } catch {
        // ignore
      }
    }
    setIsHolding(true);
    setIsCanceling(false);
    setIsLocked(false);
    setShowCancelHint(true);
    setShowLockHint(true);
    setShowDeleteIcon(false);
    setMicX(0);
    setMicY(0);
    const touch = "touches" in e ? e.touches[0] : undefined;
    setStartPosition({
      x: touch?.clientX ?? (e as React.PointerEvent).clientX,
      y: touch?.clientY ?? (e as React.PointerEvent).clientY,
    });
    // setCurrentPosition({ x: pos.clientX, y: pos.clientY });
    // Start recording immediately
    setIsInstantRecording(true);
    setIsRecording(true);
    void startRecordingInternal();
    // Show delete icon after delay
    setTimeout(() => {
      setShowDeleteIcon(true);
    }, 500);
  };
  const handleMicRelease = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInstantRecording) {
      if (isCanceling) {
        // Animate to trash and clear
        setTimeout(() => {
          setIsCanceling(false);
          setIsInstantRecording(false);
          setMicX(0);
          setMicY(0);
        }, 600);
      } else if (!isLocked) {
        // Set to locked instead of sending
        setIsLocked(true);
        setIsInstantRecording(false);
      } else {
        // Already locked, continue
        setIsInstantRecording(false);
      }
    }
    setIsHolding(false);
    setShowLockHint(false);
    setShowCancelHint(false);
    setShowDeleteIcon(false);
    setMicX(0);
    setMicY(0);
  };
  const handleMicMove = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    if (!isHolding || !isInstantRecording || isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = "touches" in e ? e.touches[0] : undefined;
    const clientX = touch?.clientX ?? (e as React.PointerEvent).clientX;
    const clientY = touch?.clientY ?? (e as React.PointerEvent).clientY;
    const deltaX = clientX - startPosition.x;
    const deltaY = clientY - startPosition.y;
    setMicX(deltaX);
    setMicY(deltaY);
    // Hide hints when starting to slide in any direction
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      setShowCancelHint(false);
      setShowLockHint(false);
    }
    if (deltaY < -30 && !isLocked) {
      setIsLocked(true);
      setIsInstantRecording(false);
      setMicX(0);
      setMicY(0);
    } else if (deltaY < -10) {
      // Keep hint if not locked yet
    }
    if (deltaX < -50 && !isCanceling) {
      setIsCanceling(true);
      setMicX(-150);
      isCancelRef.current = true;
      stopRecording();
      setShowCancelHint(false);
      setShowDeleteIcon(false);
    }
  };
  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.requestData();
      } catch {
        // ignore
      }
      rec.stop();
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length && !disabled) {
      const newFiles = [...selectedFiles, ...files];
      const newUrls = files.map((file) => {
        const url = URL.createObjectURL(file);
        blobUrlsRef.current.add(url);
        return url;
      });
      setSelectedFiles(newFiles);
      setFilePreviewUrls([...filePreviewUrls, ...newUrls]);
      onFileUpload?.(newFiles);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const removedUrl = filePreviewUrls[index];
    const newUrls = filePreviewUrls.filter((_, i) => i !== index);
    blobUrlsRef.current.delete(removedUrl);
    URL.revokeObjectURL(removedUrl);
    setSelectedFiles(newFiles);
    setFilePreviewUrls(newUrls);
  };
  const handleSendVoice = () => {
    if (!audioBlob || !audioUrl) return;
    const cleanType = (audioBlob.type || "audio/webm").split(";")[0];
    const ext = cleanType.includes("mp4") ? "mp4" : "webm";
    onSend?.("", "voice", [
      {
        name: `recording_${Date.now()}.${ext}`,
        url: audioUrl,
        type: cleanType,
        blob: audioBlob,
      },
    ]);
    // Do not revoke the URL here to keep it valid for the parent component
    blobUrlsRef.current.delete(audioUrl);
    setAudioBlob(null);
    setAudioUrl("");
    setRecordingTime(0);
    setBarHeights(new Array(8).fill(8));
  };
  const togglePauseResume = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };
  const handleCancelOrDeleteAudio = () => {
    if (isRecording) {
      isCancelRef.current = true;
      stopRecording();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      setBarHeights(new Array(8).fill(8));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      sourceRef.current?.disconnect();
      analyserRef.current = null;
      dataArrayRef.current = null;
      sourceRef.current = null;
      setIsInstantRecording(false);
      setIsHolding(false);
      setIsCanceling(false);
      setShowLockHint(false);
      setShowCancelHint(false);
      setShowDeleteIcon(false);
      setMicX(0);
      setMicY(0);
      setIsLocked(false);
      return;
    }
    // For audioBlob (review mode)
    if (audioUrl) {
      blobUrlsRef.current.delete(audioUrl);
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl("");
    setIsPaused(false);
    setRecordingTime(0);
    setBarHeights(new Array(8).fill(8));
    if (audioContextRef.current && !isRecording) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };
  const handleAttachClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    const value = e.target.value;
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex >= 0 && !value.slice(lastAtIndex).includes(" ")) {
      const filterText = value.slice(lastAtIndex + 1).toLowerCase();
      setShowMentionList(true);
      setMentionFilter(filterText);
    } else {
      setShowMentionList(false);
      setMentionFilter("");
    }
  };
  const handleMentionSelect = (option: MentionOption) => {
    if (onMentionSelect) {
      onMentionSelect(option);
    }
    setShowMentionList(false);
    setMentionFilter("");
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Enter" &&
      (value?.trim() || selectedFiles.length || audioBlob) &&
      !isSending
    ) {
      handleSend();
    }
    onKeyDown?.(e);
  };
const handleSend = () => {
  // Ref guard blocks double-click / Enter spam before React re-renders
  if (effectiveDisabled || isSending || sendLockRef.current) return;
  sendLockRef.current = true;
  setIsSending(true);

  try {
    if (
      isRecording ||
      (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive")
    ) {
      autoSendRef.current = true;
      stopRecording();
      return;
    }

    const capturedText = value?.trim();

    if (selectedFiles.length && filePreviewUrls.length) {
      // Snapshot then clear immediately so a second click cannot re-send the same files
      const filesSnapshot = selectedFiles.slice();
      const urlsSnapshot = filePreviewUrls.slice();
      setSelectedFiles([]);
      setFilePreviewUrls([]);
      onChange?.({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>);

      const filesData = filesSnapshot.map((file, index) => ({
        name: file.name || `file_${index}_${Date.now()}`,
        url: urlsSnapshot[index],
        type: file.type || "application/octet-stream",
        blob: file,
      }));

      // One call only — parent starts chunked upload
      onSend?.("", "file", filesData, capturedText || undefined);
    } else if (audioBlob && audioUrl) {
      handleSendVoice();
    } else if (capturedText) {
      onSend?.(capturedText, "text");
    }
  } finally {
    // Short unlock window; files are already cleared so re-click won't re-upload
    setTimeout(() => {
      sendLockRef.current = false;
      setIsSending(false);
    }, 600);
  }
};
  const filteredMentionOptions = mentionOptions.filter(
    (option) =>
      option.label.toLowerCase().includes(mentionFilter) ||
      option.name.toLowerCase().includes(mentionFilter)
  );
  const showMicButton = !(
    value?.length > 0 ||
    selectedFiles.length > 0 ||
    audioBlob ||
    (isRecording && !(isInstantRecording && isHolding))
  );

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleFileUploadForReply = async (file: File) => {
    if (!projectId) throw new Error("No project ID");
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("projectId", String(projectId));
    const response = await postData(`clientproject/upload_file`, formData);
    if (response.status && response.data?.fileUrl) {
      const url = `${serverURL}${response.data.fileUrl}`;
      return url;
    }
    throw new Error("Upload failed");
  };

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

  const generateReplyPdf = async (
    description: string,
    replyTitle: string,
    replyContent: string,
  ): Promise<Blob> => {
    const formattedDescription = description
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => `<p style="margin-bottom: 18px;">${line}</p>`)
      .join("");

    const html = `
      <div style="font-family: 'Helvetica', 'Arial', sans-serif; color: #1f2937; padding: 10px; line-height: 1.8; background-color: #ffffff;">
        
        <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <span style="font-size: 12px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1.5px;">Reply Title</span>
              <h1 style="font-size: 28px; color: #111827; margin: 5px 0 0 0; letter-spacing: -0.5px;">
                ${replyTitle}
              </h1>
            </div>
          </div>
        </div>

        <div style="display: table; width: 100%; margin-bottom: 40px; background-color: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #f3f4f6;">
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 10px;">
              <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Reply To</span>
              <span style="font-size: 14px; color: #111827; font-weight: 600;">${
                replyContent || "N/A"
              }</span>
            </div>
            <div style="display: table-cell; padding: 10px;">
              <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Date</span>
              <span style="font-size: 14px; color: #111827; font-weight: 600;">${new Date().toLocaleDateString(
                "en-GB"
              )}</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 10px;">
          <h3 style="font-size: 14px; text-transform: uppercase; color: #1e40af; border-left: 4px solid #3b82f6; padding-left: 12px; margin-bottom: 20px; letter-spacing: 0.5px;">
            Reply Description
          </h3>
          
          <div style="font-size: 15px; color: #374151; text-align: justify; background: #ffffff;">
            ${formattedDescription}
          </div>
        </div>

        <div style="margin-top: 60px; pt-20; border-top: 1px solid #eee; text-align: center;">
          <p style="font-size: 10px; color: #9ca3af; margin-top: 15px;">
            Document End
          </p>
        </div>
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
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

  const handleCreatePdf = async () => {
    if (!replyTo || !quillContent.trim() || !replyTitle.trim()) {
      alert("Please enter title and content.");
      return;
    }
    setIsGeneratingText("Generating...");

    const replyContent = replyTo.content || "";
    let titleSlug = slugify(replyTitle);
    let fileName;
    if (replyContent.startsWith("@update")) {
      const match = replyContent.match(/^@update_([^:]+):/);
      const updateSlug = match ? slugify(match[1]) : "";
      fileName = `@Update_Response_${updateSlug || titleSlug}.pdf`;
    } else {
      fileName = `@Reply_${titleSlug}.pdf`;
    }

    const blob = await generateReplyPdf(
      quillContent,
      replyTitle,
      replyContent,
    );
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.add(url);
    onSend?.("", "file", [
      {
        name: fileName,
        url: url,
        type: "application/pdf",
        blob: blob,
      },
    ]);
    setShowQuill(false);
    setQuillContent("");
    setReplyTitle("");
    setIsGeneratingText("Generate and Send");
  };

  const handleToggleQuill = () => {
    setShowQuill(false);
    setQuillContent("");
    setReplyTitle("");
  };

  return (
    <div className="w-full flex relative flex-col items-center">
      {isMonitorRestricted && (
        <div className="w-full mb-2 text-center py-2 bg-red-100 text-red-700 text-xs font-medium rounded-md shadow-sm">
          Chat is restricted to the Project Monitor only
        </div>
      )}
      <div className="relative w-full flex flex-col items-center">
      {(selectedFiles.length || isRecording || audioBlob || replyTo || editingMessage) && (
        <motion.div
          ref={previewRef}
          initial={{ opacity: 0, y: 0 }}
          animate={{
            opacity: 1,
            y: 0,
            x: isCanceling ? -100 : 0,
            scale: isCanceling ? 0.8 : 1,
          }}
          exit={{ opacity: 0, y: 0 }}
          className="absolute left-0 right-0 mx-auto z-30 w-[98%] px-2 pt-1.5 pb-0 rounded-t-sm shadow-xl bg-white/70 backdrop-blur-md border border-white/30 border-b-0 flex flex-col gap-1.5 transition-all duration-300"
          style={{ bottom: "calc(100% + 6px)" }}
          transition={{ duration: isCanceling ? 0.3 : 0.3 }}
        >
          {/* Reply */}
          {replyTo && (
            <div className="relative w-full border-l-4 border-blue-500 bg-gray-50/80 backdrop-blur-sm px-2.5 py-1.5 rounded-r-lg shadow-sm flex items-center gap-3">
              {/* Left side: Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-blue-600">
                    Replying to
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {replyTo.sender}
                  </span>
                </div>
                <div className="text-sm text-start text-gray-500 truncate italic">
                  {replyTo.content}
                </div>
              </div>

              {/* Right side: Action */}
              <div
                onClick={onCancelReply}
                className="p-1 rounded-full cursor-pointer hover:bg-red-600 bg-black text-white  transition-colors group"
                aria-label="Cancel reply"
              >
                <FiX
                  size={15}
                  className="group-active:scale-90 transition-transform"
                />
              </div>
            </div>
          )}
          {/* Edit bubble */}
          {editingMessage && (
            <div className="relative w-full border-l-4 border-amber-500 bg-amber-50/80 backdrop-blur-sm px-2.5 py-1.5 rounded-r-lg shadow-sm flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-600">
                    ✏️ Message to Edit
                  </span>
                </div>
                <div className="text-sm text-start text-gray-500 truncate italic">
                  {editingMessage.content}
                </div>
              </div>
              <div
                onClick={onCancelEdit}
                className="p-1 rounded-full cursor-pointer hover:bg-red-600 bg-black text-white transition-colors group"
                aria-label="Cancel edit"
              >
                <FiX size={15} className="group-active:scale-90 transition-transform" />
              </div>
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div className="flex w-full overflow-x-auto thin-scroll gap-4 pb-1 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="relative w-32 min-w-[8rem] rounded-[5px] bg-white shadow-sm hover:shadow-md border border-gray-200 overflow-hidden transition-all duration-300 flex-shrink-0"
                >
                  <div className="w-full h-24 bg-gray-50 flex items-center justify-center overflow-hidden">
                    {file.type.startsWith("image/") ? (
                      <img
                        src={filePreviewUrls[index]}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : file.type === "application/pdf" ? (
                      <div className="h-full w-full min-h-0 overflow-hidden rounded-lg">
                        <iframe
                          src={`${filePreviewUrls[index]}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                          title={file.name}
                          className="h-full w-[calc(100%+20px)] max-h-24 border-0 pointer-events-none -mr-5"
                        />
                      </div>
                    ) : file.type.startsWith("audio/") ? (
                      <audio
                        controls
                        src={filePreviewUrls[index]}
                        className="w-full px-1"
                      />
                    ) : file.type.startsWith("video/") ? (
                      <video
                        controls
                        src={filePreviewUrls[index]}
                        className="w-full h-full object-cover"
                        preload="auto"
                      />
                    ) : file.type === "application/msword" ||
                      file.type ===
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? (
                      <div className="text-gray-400 text-sm">
                        <FaFileWord color="#2B579A" size={40} />
                      </div>
                    ) : file.type === "application/zip" ? (
                      <div className="text-gray-400 text-sm">
                        <FaFileArchive color="#FFC107" size={40} />
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm">
                        <FaFileInvoice color="#FFDA00" size={40} />
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-white">
                    <p
                      className="text-xs text-gray-800 font-medium text-center"
                      title={file.name}
                    >
                      {(() => {
                        const name = file.name;
                        const dotIndex = name.lastIndexOf(".");
                        const base = name.substring(0, dotIndex);
                        const ext = name.substring(dotIndex);
                        const maxLength = 10;
                        const shortBase =
                          base.length > maxLength
                            ? base.substring(0, maxLength) + "../"
                            : base;
                        return shortBase + ext;
                      })()}
                    </p>
                  </div>
                  <div
                    onClick={() => handleRemoveFile(index)}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                    title="Remove"
                  >
                    <FiX size={12} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {(isRecording || audioBlob) && (
            <div className="flex items-center gap-4 pb-2 w-full px-1">
              {(() => {
                if (isInstantRecording && !isLocked && !audioBlob) {
                  // Instant recording UI: frequency bars + timer only
                  return (
                    <div className=" flex items-center justify-evenly w-full space-y-2">
                      {/* Blinking mic at start */}
                      <motion.div
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        <FiMic size={24} className="text-red-500" />
                      </motion.div>
                      <div className="flex items-center gap-x-2">
                        <div className="flex items-center gap-[2px] h-20 overflow-hidden">
                          {barHeights.map((height, i) => (
                            <motion.div
                              key={i}
                              className="w-[3px] rounded-full bg-red-500"
                              initial={{ height: 8 }}
                              animate={{ height }}
                              transition={{ duration: 0.05, ease: "easeOut" }}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-gray-700 text-sm">
                          {formatTime(recordingTime)}
                        </span>
                      </div>
                      {/* Lock hint on the right side vertically */}
                      {showLockHint && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className=" flex flex-col items-center z-20"
                        >
                          <IoIosLock size={20} className="text-blue-500" />
                          <motion.div
                            initial={{ y: 5 }}
                            animate={{ y: [-5, 5, -5] }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          >
                            <IoIosArrowUp
                              size={16}
                              className="text-blue-500 mt-1"
                            />
                          </motion.div>
                          <span className="text-xs text-blue-500 mt-1">
                            Lock
                          </span>
                        </motion.div>
                      )}
                    </div>
                  );
                } else {
                  // Normal recording UI
                  return isRecording ? (
                    <>
                      <div
                        onClick={togglePauseResume}
                        className="p-2 cursor-pointer bg-yellow-50 hover:bg-gray-200 text-blue-600 hover:text-blue-800 rounded-full transition"
                        title={isPaused ? "Resume" : "Pause"}
                      >
                        {isPaused ? (
                          <FiPlay size={15} />
                        ) : (
                          <FiPause size={15} />
                        )}
                      </div>
                      <div className="flex items-center gap-[2px] h-20 overflow-hidden">
                        {barHeights.map((height, i) => (
                          <motion.div
                            key={i}
                            className="w-[3px] rounded-full bg-red-500"
                            initial={{ height: 8 }}
                            animate={{ height }}
                            transition={{ duration: 0.05, ease: "easeOut" }}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-gray-700 text-sm">
                        {formatTime(recordingTime)}
                      </span>
                      {isPaused && (
                        <div
                          onClick={stopRecording}
                          className="p-2 cursor-pointer bg-blue-100 hover:bg-gray-200 text-blue-600 hover:text-blue-800 rounded-full transition"
                          title="Preview"
                        >
                          <TbShareplay size={15} />
                        </div>
                      )}
                      <div
                        onClick={handleCancelOrDeleteAudio}
                        className="p-2 bg-red-100 cursor-pointer hover:bg-gray-200 text-red-600 hover:text-red-800 rounded-full transition"
                        title="Cancel recording"
                      >
                        <FiTrash2 size={15} />
                      </div>
                    </>
                  ) : (
                    audioBlob && (
                      <div className="flex items-center gap-2 flex-1">
                        <audio
                          controls
                          src={audioUrl}
                          className="w-full h-10"
                        />
                        <div
                          onClick={handleCancelOrDeleteAudio}
                          className="p-2 bg-red-100 cursor-pointer hover:bg-gray-200 text-red-600 hover:text-red-800 rounded-full transition"
                          title="Delete audio"
                        >
                          <FiTrash2 size={15} />
                        </div>
                      </div>
                    )
                  );
                }
              })()}
            </div>
          )}
        </motion.div>
      )}
      <div
        className={`
          relative
          w-[100%]
          h-[34px]
          bg-white
          rounded-full
          py-1
          pl-1
          pr-1
          flex
          items-center
          shadow-sm
          ${isHolding && isInstantRecording && !isLocked ? "overflow-visible" : ""}
          ${
            isHolding && isInstantRecording && !isLocked
              ? "overflow-visible"
              : ""
          }
        `}
      >
        {isRecording ? (
          <div className="flex-grow" />
        ) : (
          <div className="relative mr-3">
            <div
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 cursor-pointer hover:scale-110 transition-transform duration-200 bg-[#2969FF] rounded-full shadow-sm shadow-gray-300"
            >
              <MdGridView
                size={17}
                className={`${disabled ? "text-white/80" : "text-white"}`}
              />
            </div>
            {showMenu && (
              <div className="absolute bottom-full left-0 mb-1 z-20">
                {/* The Container: Ultra-thin border, heavy blur, and soft shadow */}
                <div className="relative p-[1px] rounded-2xl bg-gradient-to-b from-white/20 to-transparent">
                  <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-2xl p-2 min-w-[210px]">
                    <ul className="space-y-1">
                      {/* Attach File Option */}
                      <li
                        onClick={() => {
                          handleAttachClick();
                          setShowMenu(false);
                        }}
                        className="group relative flex items-center gap-3 px-4 py-3 cursor-pointer rounded-xl transition-all duration-300 hover:bg-black/[0.03]"
                      >
                        {/* Subtle Icon Glow */}
                        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                          <IoMdAttach
                            size={18}
                            className="text-gray-600 group-hover:text-blue-500"
                          />
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-gray-800 tracking-tight">
                            Attach File
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-none">
                            Local System
                          </span>
                        </div>
                      </li>
                      {replyTo && (
                        <li
                          onClick={() => {
                            setShowQuill(true);
                            setShowMenu(false);
                          }}
                          className="group relative flex items-center gap-3 px-4 py-3 cursor-pointer rounded-xl transition-all duration-300 hover:bg-black/[0.03]"
                        >
                          {/* Minimalist Icon Holder */}
                          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                            <MdOutlineEditNote
                              size={20}
                              className="text-gray-600 group-hover:text-purple-500"
                            />
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold text-gray-800 tracking-tight">
                              PDF Response
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-none">
                              Smart Editor
                            </span>
                          </div>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {!isRecording ? (
          <div className="relative flex-grow">
            <input
              ref={inputRef}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={effectiveDisabled}
              placeholder={effectivePlaceholder}
              type="text"
              className="
                w-full
                h-full
                bg-transparent
                text-black
                border-0
                text-[14px]
                font-medium
                tracking-[0.04rem]
                border-b-[1.5px]
                border-[#C2C2C2]
                focus:border-[#1B7FF0]
                focus:outline-none
                placeholder-[#C2C2C2]
                text-sm
                pb-[2px]
              "
            />
            {showMentionList && filteredMentionOptions.length > 0 && (
              <div className="absolute bottom-10 left-0 w-full max-w-fit bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {filteredMentionOptions.map((option) => (
                  <div
                    key={`${option.type}-${option.id}`}
                    className="flex items-center gap-3 px-4 py-1 cursor-pointer text-sm text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-600 transition-colors duration-200"
                    onClick={() => handleMentionSelect(option)}
                  >
                    <img
                      src={option.imageUrl || UserIcon}
                      alt={`${option.name} avatar`}
                      className="w-7 h-7 rounded-full object-cover border border-gray-200 shadow-sm"
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-[13px]">
                        {option.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <div className="flex items-center space-x-2 ml-2">
          {showMicButton ? (
            <>
              {isHolding && isInstantRecording && !isLocked && (
                <>
                  {/* Delete icon fixed left */}
                  {showDeleteIcon && !isCanceling && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 0.7, scale: 1 }}
                      className=""
                    >
                      <FiTrash2 size={16} className="text-red-400" />
                    </motion.div>
                  )}
                  {/* Cancel hint with bouncing arrow in same row left of mic */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    className=" flex items-center gap-1"
                  >
                    <motion.div
                      initial={{ x: 10 }}
                      animate={{ x: [-10, 10, -10] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <IoIosArrowBack
                        size={16}
                        className={`${
                          showCancelHint ? "text-gray-500" : "text-white"
                        }`}
                      />
                    </motion.div>
                    <span
                      className={`text-xs ${
                        showCancelHint ? "text-gray-500" : "text-white"
                      } whitespace-nowrap`}
                    >
                      Slide to cancel
                    </span>
                  </motion.div>

                  {isCanceling && (
                    <motion.div
                      className="absolute -left-32 top-1/2 -translate-y-1/2 z-10"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiTrash2
                        size={24}
                        className="text-red-500 drop-shadow-lg"
                      />
                    </motion.div>
                  )}
                </>
              )}
              <motion.div
                data-mic-record="true"
                className={`rounded-full flex items-center justify-center p-1.5 transition-transform shadow-lg
                  ${
                    effectiveDisabled || selectedFiles.length || audioBlob
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                style={{
                  background: "linear-gradient(135deg, #7CFF73, #4CE4A1)",
                  touchAction: "none",
                }}
                animate={{
                  scale: isHolding ? 1.1 : 1,
                  x: micX,
                  y: micY,
                }}
                transition={{
                  duration: 0.1,
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  y: { type: "spring", stiffness: 300, damping: 30 },
                }}
                onPointerDown={handleMicPress}
                onPointerUp={handleMicRelease}
                onPointerMove={handleMicMove}
                onPointerLeave={handleMicRelease}
                onPointerCancel={handleMicRelease}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <FiMic
                  size={17}
                  color={
                    disabled || selectedFiles.length || audioBlob
                      ? "#A0A0A0"
                      : "#343434"
                  }
                />
              </motion.div>
            </>
          ) : (
            <div
              className={`rounded-full flex items-center pr-1 pl-2 py-1.5 hover:scale-110 transition-transform justify-center shadow-lg
                ${
                  disabled || isSending
                    ? "cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              style={{
                background: "linear-gradient(135deg, #7CFF73, #4CE4A1)",
              }}
              onClick={handleSend}
            >
              <IoMdSend
                size={17}
                color={disabled || isSending ? "#A0A0A0" : "#343434"}
              />
            </div>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept={allowedFileTypes.join(",")}
          multiple
        />
      </div>
      </div>
      {showQuill && (
        <div className="fixed inset-0 z-50 font-librefranklin flex items-center justify-center px-4">
          {/* Backdrop */}
          <div className="absolute  inset-0 bg-white/20 backdrop-blur-sm z-40" />

          {/* Modal */}
          <div className="relative z-50 w-full max-h-[100vh] overflow-y-hidden max-w-xl p-6 rounded-xl border border-white/50 bg-white backdrop-blur-3xl shadow-xl">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-400 pb-3 mb-5">
              <div className="text-xl  font-bold tracking-wide bg-gradient-to-r from-[#031746] to-[#0982fa] bg-clip-text text-transparent">
                Create PDF Response
              </div>
              <div
                onClick={handleToggleQuill}
                className="text-gray-500 hover:scale-110 hover:text-[#fc134c] cursor-pointer transition"
              >
                <IoMdCloseCircle
                  size={25}
                  className="text-black hover:text-[#fc134c]"
                />
              </div>
            </div>

            {/* Body */}
            <div className="space-y-5 max-h-[70vh] thin-scroll overflow-y-auto text-gray-800 pr-2">
              <div className="w-full text-start">
                <label className="text-sm text-start font-semibold text-gray-700">
                  Reply Title*
                </label>
              </div>
              <div className="w-full p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
                <input
                  type="text"
                  value={replyTitle}
                  onChange={(e) => setReplyTitle(e.target.value)}
                  placeholder="Enter reply title"
                  className="w-full px-4 py-1.5 text-[14px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
                />
              </div>

              <label className="text-sm text-start font-semibold text-gray-700 block">
                Reply Content*
              </label>
              <QuillEditor
                initialText={quillContent}
                onChange={setQuillContent}
                placeholder="Write your reply here..."
                onFileUpload={handleFileUploadForReply}
              />

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <div
                  onClick={handleToggleQuill}
                  className="
    group relative w-full cursor-pointer overflow-hidden rounded-md 
    border border-red-500/30 bg-white px-6 py-2 
    text-sm font-bold uppercase tracking-widest text-red-400 
    backdrop-blur-md transition-all duration-300 
    hover:border-red-500 hover:bg-red-500/10 hover:text-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]
    active:scale-95
  "
                >
                  <span className="absolute left-0 top-0 h-[2px] w-0 bg-red-500 transition-all duration-300 group-hover:w-full"></span>
                  <span className="absolute bottom-0 right-0 h-[2px] w-0 bg-red-500 transition-all duration-300 group-hover:w-full"></span>

                  <span className="relative z-10 flex items-center justify-center gap-2">
                    CANCEL
                  </span>
                </div>

                <div
                  onClick={() => {
                    if (isGeneratingText === "Generate and Send") {
                      handleCreatePdf();
                    }
                  }}
                  className={`
    group relative w-full overflow-hidden rounded-md border px-6 py-2 
    text-sm font-bold uppercase tracking-widest transition-all duration-300 backdrop-blur-md
    ${
      isGeneratingText === "Generate and Send"
        ? "cursor-pointer border-blue-500/30 bg-white text-blue-400 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-95"
        : "cursor-not-allowed border-blue-500/50 bg-blue-50/50 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
    }
  `}
                >
                  {/* Top Animated Line */}
                  <span
                    className={`absolute left-0 top-0 h-[2px] bg-blue-500 transition-all duration-500 
    ${
      isGeneratingText === "Generate and Send"
        ? "w-0 group-hover:w-full"
        : "w-full animate-pulse"
    }`}
                  ></span>

                  {/* Bottom Animated Line */}
                  <span
                    className={`absolute bottom-0 right-0 h-[2px] bg-blue-500 transition-all duration-500 
    ${
      isGeneratingText === "Generate and Send"
        ? "w-0 group-hover:w-full"
        : "w-full animate-pulse"
    }`}
                  ></span>

                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isGeneratingText === "Generating..." && (
                      <svg
                        className="h-4 w-4 animate-spin text-blue-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {isGeneratingText}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MikeSearch;