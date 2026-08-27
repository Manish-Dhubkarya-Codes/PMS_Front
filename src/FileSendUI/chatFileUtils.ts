import { serverURL } from "../BackendConnections/FetchBackendServices";
import { toAbsoluteFileUrl, toRelativeFileUrl } from "./fileUrl";

/** Always return a usable MIME type so UI never crashes on null/undefined. */
export function normalizeMimeType(
  type: string | null | undefined,
  fileName?: string | null,
): string {
  const raw = type && typeof type === "string" ? type.trim() : "";
  const name = (fileName || "").toLowerCase();
  const isRecording = /^recording_/i.test(name);
  const isGeneric =
    !raw ||
    raw === "application/octet-stream" ||
    raw === "binary/octet-stream";

  // Voice notes are recorded as webm; never treat those as video.
  if (isRecording && (name.endsWith(".webm") || raw.startsWith("video/"))) {
    return "audio/webm";
  }

  if (raw && !isGeneric) {
    return raw;
  }

  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) {
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".bmp")) return "image/bmp";
    if (name.endsWith(".svg")) return "image/svg+xml";
    return "image/jpeg";
  }
  if (
    /^recording_/i.test(name) ||
    /\.(mp3|wav|ogg|m4a|aac|mpeg)$/i.test(name)
  ) {
    if (name.endsWith(".wav")) return "audio/wav";
    if (name.endsWith(".ogg")) return "audio/ogg";
    if (name.endsWith(".webm")) return "audio/webm";
    if (name.endsWith(".m4a") || name.endsWith(".aac")) return "audio/mp4";
    return "audio/mpeg";
  }
  if (/\.(mp4|webm|mov|mkv)$/i.test(name)) {
    if (name.endsWith(".webm")) return "video/webm";
    if (name.endsWith(".mov")) return "video/quicktime";
    return "video/mp4";
  }
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export function formatChatTime(timestamp?: string | Date | null): string {
  if (!timestamp) return "";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function isChatAudioFile(
  type?: string | null,
  name?: string | null,
): boolean {
  const normalized = normalizeMimeType(type, name);
  if (normalized.startsWith("audio/")) return true;
  const n = (name || "").toLowerCase();
  return (
    /^recording_/i.test(n) ||
    /\.(m4a|mp3|wav|ogg|aac|mpeg)$/i.test(n)
  );
}

export function buildChatFilePayload(input: {
  name?: string | null;
  url?: string | null;
  type?: string | null;
  originalName?: string | null;
}) {
  const name = input.originalName || input.name || "File";
  const relativeUrl = toRelativeFileUrl(input.url || "", serverURL);
  const absoluteUrl = toAbsoluteFileUrl(relativeUrl, serverURL);
  const type = normalizeMimeType(input.type, name);
  return {
    name,
    relativeUrl,
    absoluteUrl,
    type,
    file: {
      name,
      url: absoluteUrl,
      type,
    },
    msgData: {
      name,
      originalName: name,
      url: relativeUrl,
      type,
    },
  };
}

function isServerStoredFilename(name: string): boolean {
  const base = (name || "").split(/[\\/]/).pop() || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(\.[^.]+)?$/i.test(
    base,
  );
}

export function sanitizeDownloadFilename(
  preferred?: string | null,
  fileUrl?: string | null,
): string {
  const urlBase = (fileUrl || "").split(/[?#]/)[0].split(/[\\/]/).pop() || "file";
  const raw = String(preferred || "").trim();
  const base = raw.split(/[\\/]/).pop() || "";
  if (base && !isServerStoredFilename(base)) return base;
  if (base) return base;
  return urlBase || "file";
}

/** Download a chat file using the original device filename, not the UUID on disk. */
export async function downloadChatFile(
  fileUrl: string | undefined | null,
  originalName?: string | null,
): Promise<void> {
  if (!fileUrl) throw new Error("Missing file url");
  const filename = sanitizeDownloadFilename(originalName, fileUrl);
  const stored = (fileUrl.split(/[?#]/)[0].split(/[\\/]/).pop() || "").trim();

  const trigger = (href: string, asName: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = asName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")) {
    trigger(fileUrl, filename);
    return;
  }

  const apiUrl = `${serverURL}/clientproject/download_chat_file?file=${encodeURIComponent(stored)}&name=${encodeURIComponent(filename)}`;
  const absolute = toAbsoluteFileUrl(fileUrl, serverURL);

  try {
    let response = await fetch(apiUrl, { credentials: "include" });
    if (!response.ok) {
      response = await fetch(absolute, { credentials: "include" });
    }
    if (!response.ok) throw new Error("Failed to fetch the file");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    trigger(blobUrl, filename);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    trigger(absolute, filename);
    throw err;
  }
}

export type ChatUploaderRole =
  | "head"
  | "client"
  | "tl"
  | "tl_monitor"
  | "employee";

export function socketEventForRole(role: ChatUploaderRole): string {
  if (role === "head") return "sendHeadMessage";
  if (role === "tl") return "sendTLMessage";
  if (role === "tl_monitor") return "sendTLToMonitorMessage";
  if (role === "employee") return "sendEmployeeMessage";
  return "sendClientMessage";
}

/** Prevents the same tempId from being emitted more than once. */
const emittedTempIds = new Set<string>();

export function clearEmittedTempId(tempId?: string) {
  if (tempId) emittedTempIds.delete(tempId);
}

/** Emit file chat message once; retry only while disconnected. */
export function emitChatFileMessage(options: {
  socket: any;
  role: ChatUploaderRole;
  projectId: string | number;
  msgData: { name: string; url: string; type: string };
  caption?: string | null;
  timestamp: string;
  tempId: string;
  replyTo?: unknown;
  extra?: Record<string, unknown>;
}): void {
  const { socket, role, projectId, msgData, caption, timestamp, tempId, replyTo, extra } =
    options;
  if (!socket || !projectId || !tempId) return;

  // Hard guard against double-complete / double-click paths
  if (emittedTempIds.has(tempId)) {
    console.warn("Skip duplicate file emit for tempId", tempId);
    return;
  }

  const eventName = socketEventForRole(role);
  const payload = {
    projectId,
    fromRole: role,
    type: (isChatAudioFile(msgData.type, msgData.name) ? "audio" : "file") as
      | "audio"
      | "file",
    msgData,
    caption: caption || null,
    timestamp,
    tempId,
    replyTo: replyTo || null,
    ...(extra || {}),
  };

  const tryEmit = () => {
    if (!socket.connected) return false;
    emittedTempIds.add(tempId);
    socket.emit(eventName, payload);
    // Auto-expire guard after 5 minutes so retries of failed old sessions are possible
    setTimeout(() => emittedTempIds.delete(tempId), 5 * 60 * 1000);
    return true;
  };

  if (tryEmit()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (tryEmit() || attempts >= 15) {
      clearInterval(timer);
    }
  }, 300);
}
