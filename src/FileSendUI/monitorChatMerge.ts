import { buildChatFilePayload } from "./chatFileUtils";
import { fileUrlKey } from "./chatIdentity";
import { toAbsoluteFileUrl } from "./fileUrl";
import { serverURL } from "../BackendConnections/FetchBackendServices";
import { sameChatTimestamp } from "../utils/chatLive";

function sameFile(a?: string, b?: string) {
  const ka = fileUrlKey(a);
  const kb = fileUrlKey(b);
  return Boolean(ka && kb && ka === kb);
}

/**
 * Merge TL↔Employee monitor-room messages (newTLMonitorMessage / messageAck)
 * without duplicating bubbles.
 */
export function mergeMonitorChatMessage<T extends Record<string, any>>(
  prev: T[],
  data: { fromRole?: string; msg: any },
  options: {
    /** Current user employeeId */
    myId: string;
    /** Viewer is team leader? */
    isTLViewer: boolean;
  },
): T[] {
  const incoming = data?.msg;
  if (!incoming) return prev;

  const fromRole = data.fromRole || incoming.fromRole || (incoming.fromTL ? "tl" : "employee");
  const fromTL = fromRole === "tl" || incoming.fromTL === true;
  const isFile =
    incoming.type === "file" ||
    incoming.type === "audio" ||
    Boolean(incoming.data?.url);

  const incomingFileName = incoming.data?.name || incoming.file?.name;
  const incomingFileUrl = incoming.data?.url || incoming.file?.url;
  const incomingText =
    !isFile ? incoming.data || incoming.message : undefined;

  // 1) tempId upgrade
  if (incoming.tempId) {
    const idx = prev.findIndex((m) => m.tempId && m.tempId === incoming.tempId);
    if (idx !== -1) {
      return upgrade(prev, idx, incoming, fromTL, options, {
        isFile,
        incomingFileName,
        incomingFileUrl,
        incomingText,
      });
    }
  }

  // 2) messageId upgrade
  if (incoming.messageId) {
    const idx = prev.findIndex(
      (m) => m.messageId && m.messageId === incoming.messageId,
    );
    if (idx !== -1) {
      return upgrade(prev, idx, incoming, fromTL, options, {
        isFile,
        incomingFileName,
        incomingFileUrl,
        incomingText,
      });
    }
  }

  // 3) same file url
  if (isFile && incomingFileUrl) {
    const idx = prev.findIndex(
      (m) => m.type === "file" && sameFile(m.file?.url, incomingFileUrl),
    );
    if (idx !== -1) {
      return upgrade(prev, idx, incoming, fromTL, options, {
        isFile,
        incomingFileName,
        incomingFileUrl,
        incomingText,
      });
    }
  }

  // 4) timestamp + content
  const dup = prev.some((m) => {
    if (m.timestamp !== incoming.timestamp) return false;
    if (!isFile) return m.type === "text" && m.message === incomingText;
    return (
      m.type === "file" &&
      (m.file?.name === incomingFileName ||
        sameFile(m.file?.url, incomingFileUrl))
    );
  });
  if (dup) return prev;

  // 5) new message
  const senderId = incoming.senderId != null ? String(incoming.senderId) : "";
  const isMe = senderId && senderId === String(options.myId);
  // TL viewer: own on right, employees left. Employee viewer: own right, TL left.
  const isLeft = options.isTLViewer ? !fromTL : !isMe && fromTL ? true : !isMe;

  const newMsg: any = {
    type: isFile ? "file" : "text",
    isLeft,
    fromTL,
    timestamp: incoming.timestamp || new Date().toISOString(),
    seen_by: incoming.seen_by || [],
    id: incoming.id,
    messageId: incoming.messageId,
    replyTo: incoming.replyTo || null,
    senderId: senderId || undefined,
    senderName: incoming.senderName || (fromTL ? "Team Leader" : "Employee"),
    senderPic: incoming.senderPic || "",
    caption: incoming.caption || undefined,
    tempId: undefined,
  };

  if (!isFile) newMsg.message = incomingText;
  else {
    newMsg.file = buildChatFilePayload({
      name: incomingFileName,
      url: incomingFileUrl,
      type: incoming.data?.type,
    }).file;
  }

  return [...prev, newMsg as T].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  );
}

function upgrade<T extends Record<string, any>>(
  prev: T[],
  idx: number,
  incoming: any,
  fromTL: boolean,
  options: { myId: string; isTLViewer: boolean },
  meta: {
    isFile: boolean;
    incomingFileName?: string;
    incomingFileUrl?: string;
    incomingText?: any;
  },
): T[] {
  const existing = prev[idx];
  const next = [...prev];
  const senderId =
    incoming.senderId != null
      ? String(incoming.senderId)
      : existing.senderId;
  const isMe = senderId && String(senderId) === String(options.myId);
  const isLeft = options.isTLViewer
    ? !fromTL
    : !isMe && fromTL
      ? true
      : !isMe;

  next[idx] = {
    ...existing,
    id: incoming.id ?? existing.id,
    messageId: incoming.messageId || existing.messageId,
    timestamp: incoming.timestamp || existing.timestamp,
    seen_by: incoming.seen_by || existing.seen_by || [],
    fromTL,
    isLeft,
    senderId,
    senderName:
      incoming.senderName || existing.senderName || (fromTL ? "Team Leader" : "Employee"),
    senderPic: incoming.senderPic || existing.senderPic || "",
    tempId: undefined,
    replyTo: existing.replyTo || incoming.replyTo || null,
    caption: existing.caption || incoming.caption || undefined,
    ...(meta.isFile
      ? {
          file: buildChatFilePayload({
            name: meta.incomingFileName || existing.file?.name,
            url: meta.incomingFileUrl || existing.file?.url,
            type: incoming.data?.type || existing.file?.type,
          }).file,
        }
      : meta.incomingText !== undefined
        ? { message: meta.incomingText }
        : {}),
  };
  return next;
}

export function appendLocalMonitorFileMessage<T extends Record<string, any>>(
  prev: T[],
  msg: T,
): T[] {
  const already = prev.some((m) => {
    if (msg.tempId && m.tempId === msg.tempId) return true;
    if (msg.messageId && m.messageId === msg.messageId) return true;
    if (
      m.type === "file" &&
      (msg as any).file?.url &&
      sameFile(m.file?.url, (msg as any).file?.url)
    ) {
      return true;
    }
    return false;
  });
  if (already) return prev;
  return [...prev, msg].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  );
}

/** Pretty label: "Rahul" | "TEAM LEADER" — never "TEAM LEADER | TEAM LEADER" */
export function formatMonitorSenderLabel(options: {
  msg: {
    senderId?: string;
    senderName?: string;
    fromTL?: boolean;
    fromClient?: boolean;
  };
  myId: string;
  myRoleLabel: "TEAM LEADER" | "EMPLOYEE";
  clientName?: string;
  tlFallbackName?: string;
}): { name: string; role: string } {
  const { msg, myId, myRoleLabel, clientName, tlFallbackName } = options;

  if (msg.fromClient) {
    return { name: clientName || "Client", role: "CLIENT" };
  }

  const role = msg.fromTL ? "TEAM LEADER" : "EMPLOYEE";

  if (msg.senderId && String(msg.senderId) === String(myId)) {
    return { name: "YOU", role: myRoleLabel };
  }

  const raw = (msg.senderName || "").trim();
  // Avoid using role words as a person's name
  const isGeneric =
    !raw ||
    /^(you|team leader|teamleader|employee|unknown)$/i.test(raw);

  if (!isGeneric) {
    return { name: raw, role };
  }

  if (msg.fromTL) {
    return {
      name: (tlFallbackName || "Team Leader").trim() || "Team Leader",
      role: "TEAM LEADER",
    };
  }

  return { name: "Employee", role: "EMPLOYEE" };
}

export function absoluteMonitorFileUrl(url: string) {
  return toAbsoluteFileUrl(url, serverURL);
}

/** Merge a REST/socket chat snapshot with in-flight optimistic rows. */
export function mergeMonitorSnapshot<T extends Record<string, any>>(
  serverMessages: T[],
  prev: T[],
): T[] {
  if (serverMessages.length === 0 && prev.length > 0) return prev;
  const localOnly = prev.filter((local) => {
    if (!local.tempId && !local.file && !local.message) return false;
    return !serverMessages.some((serverMsg) => {
      if (local.tempId && serverMsg.tempId && local.tempId === serverMsg.tempId) return true;
      if (local.messageId && serverMsg.messageId && local.messageId === serverMsg.messageId) return true;
      if (local.file?.url && serverMsg.file?.url && sameFile(local.file.url, serverMsg.file.url)) {
        return true;
      }
      if (
        local.type === "file" &&
        serverMsg.type === "file" &&
        local.file?.name &&
        local.file.name === serverMsg.file?.name &&
        sameChatTimestamp(local.timestamp, serverMsg.timestamp)
      ) {
        return true;
      }
      if (
        local.type === "text" &&
        serverMsg.type === "text" &&
        local.message === serverMsg.message &&
        sameChatTimestamp(local.timestamp, serverMsg.timestamp)
      ) {
        return true;
      }
      return false;
    });
  });
  return [...serverMessages, ...localOnly].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  );
}
