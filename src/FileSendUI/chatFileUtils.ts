import { serverURL } from "../BackendConnections/FetchBackendServices";
import { toAbsoluteFileUrl, toRelativeFileUrl } from "./fileUrl";

/** Always return a usable MIME type so UI never crashes on null/undefined. */
export function normalizeMimeType(
  type: string | null | undefined,
  fileName?: string | null,
): string {
  if (type && typeof type === "string" && type.trim()) {
    return type.trim();
  }

  const name = (fileName || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) {
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".bmp")) return "image/bmp";
    if (name.endsWith(".svg")) return "image/svg+xml";
    return "image/jpeg";
  }
  if (/\.(mp4|webm|mov|mkv)$/i.test(name)) {
    if (name.endsWith(".webm")) return "video/webm";
    if (name.endsWith(".mov")) return "video/quicktime";
    return "video/mp4";
  }
  if (/\.(mp3|wav|ogg|m4a)$/i.test(name)) {
    if (name.endsWith(".wav")) return "audio/wav";
    if (name.endsWith(".ogg")) return "audio/ogg";
    return "audio/mpeg";
  }
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export function buildChatFilePayload(input: {
  name?: string | null;
  url?: string | null;
  type?: string | null;
}) {
  const name = input.name || "File";
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
      url: relativeUrl,
      type,
    },
  };
}

export type ChatUploaderRole = "head" | "client" | "tl";

export function socketEventForRole(role: ChatUploaderRole): string {
  if (role === "head") return "sendHeadMessage";
  if (role === "tl") return "sendTLMessage";
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
    type: "file" as const,
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
