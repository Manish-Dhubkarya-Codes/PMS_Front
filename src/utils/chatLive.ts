import notificationSoundUrl from "../assets/CredientialAssets/Chat_Notification_Sound.mp3";
import {
  fileUrlKey,
  isSystemChatMessage,
  parseChatJson,
  storedChatFileData,
} from "../FileSendUI/chatIdentity";

/** Employee-side seen flag. Older messages used "monitor". */
export function seenByEmployee(seen_by?: string[] | null): boolean {
  if (!Array.isArray(seen_by)) return false;
  return seen_by.includes("employee") || seen_by.includes("monitor");
}

export function isQuietProjectStatus(status?: string | null): boolean {
  const s = String(status || "").trim().toLowerCase();
  return s === "completed" || s === "hold";
}

export function isZipFile(type?: string | null, name?: string | null): boolean {
  const t = String(type || "").toLowerCase();
  const n = String(name || "").toLowerCase();
  return (
    t.includes("zip") ||
    t.includes("compressed") ||
    t === "application/x-zip-compressed" ||
    n.endsWith(".zip")
  );
}

export function isProjectDetailsPdf(name?: string | null, type?: string | null): boolean {
  const n = String(name || "");
  const t = String(type || "").toLowerCase();
  return (
    /^Project_Details_/i.test(n) &&
    (t.includes("pdf") || n.toLowerCase().endsWith(".pdf"))
  );
}

function unreadMessageKey(parsed: any): string {
  if (parsed?.messageId) return `mid:${parsed.messageId}`;
  const file = storedChatFileData(parsed);
  const fKey = fileUrlKey(file?.url);
  if (fKey) return `file:${fKey}`;
  const text =
    typeof parsed?.data === "string"
      ? parsed.data
      : parsed?.message || file?.name || "";
  return `ts:${parsed?.timestamp || ""}|${text}`;
}

/**
 * Messages that should ping landing-page unread badges.
 * System rows and the auto-generated Project Details PDF are visible in chat
 * but are not conversation notifications.
 */
export function isNotifiableChatMessage(
  parsed: any,
  viewer: string,
): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  if (isSystemChatMessage(parsed) || parsed.isDeleted) return false;
  const file = storedChatFileData(parsed);
  if (isProjectDetailsPdf(file?.name, file?.type)) return false;
  const viewerKey = String(viewer || "").toLowerCase();
  if (viewerKey === "employee" || viewerKey === "monitor") {
    if (seenByEmployee(parsed.seen_by)) return false;
  } else if (Array.isArray(parsed.seen_by) && parsed.seen_by.includes(viewer)) {
    return false;
  }
  const hasText =
    (typeof parsed.data === "string" && parsed.data.trim().length > 0) ||
    (typeof parsed.message === "string" && parsed.message.trim().length > 0);
  const hasFile = Boolean(file?.url && file?.name);
  const hasCaption =
    typeof parsed.caption === "string" && parsed.caption.trim().length > 0;
  if (!hasText && !hasFile && !hasCaption) return false;
  return true;
}

export function countUnreadMessages(
  rows: unknown[] | undefined | null,
  viewer: string,
  keys: Set<string> = new Set(),
): { count: number; hasMention: boolean; keys: Set<string> } {
  let count = 0;
  let hasMention = false;
  for (const raw of rows || []) {
    const parsed = parseChatJson(raw) || (raw && typeof raw === "object" ? (raw as any) : null);
    if (!parsed || !isNotifiableChatMessage(parsed, viewer)) continue;
    const key = unreadMessageKey(parsed);
    if (keys.has(key)) continue;
    keys.add(key);
    count++;
    if (parsed.mention?.type === viewer) hasMention = true;
  }
  return { count, hasMention, keys };
}

export function sameChatTimestamp(a?: string | null, b?: string | null, windowMs = 8000): boolean {
  if (!a || !b) return false;
  if (String(a) === String(b)) return true;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(ta - tb) < windowMs;
}

export function matchesChatMessage(
  msg: {
    timestamp?: string;
    messageId?: string;
    tempId?: string;
    id?: number;
  },
  data: {
    timestamp?: string;
    messageId?: string;
    tempId?: string;
    index?: number;
    id?: number;
  },
): boolean {
  if (data.messageId && msg.messageId && String(data.messageId) === String(msg.messageId)) {
    return true;
  }
  if (data.tempId && msg.tempId && String(data.tempId) === String(msg.tempId)) {
    return true;
  }
  if (sameChatTimestamp(msg.timestamp, data.timestamp)) {
    return true;
  }
  if (data.messageId || data.timestamp) return false;
  if (
    typeof data.index === "number" &&
    typeof msg.id === "number" &&
    data.index === msg.id
  ) {
    return true;
  }
  if (typeof data.id === "number" && typeof msg.id === "number" && data.id === msg.id) {
    return true;
  }
  return false;
}

export function seenByRole(
  seen_by: string[] | null | undefined,
  role: "head" | "client" | "tl",
): boolean {
  if (!Array.isArray(seen_by)) return false;
  if (role === "tl") {
    return (
      seen_by.includes("tl") ||
      seen_by.includes("team leader") ||
      seen_by.includes("teamleader")
    );
  }
  return seen_by.includes(role);
}

export function mergeSeenBy(
  ...lists: Array<string[] | null | undefined>
): string[] {
  const out = new Set<string>();
  lists.forEach((list) => {
    (list || []).forEach((item) => {
      if (item) out.add(item);
    });
  });
  return Array.from(out);
}

/** Client/TL files live in *audios; Head files (except audio) live in *chats. */
export function seenStorageType(msg: {
  type?: string;
  fromHead?: boolean;
  file?: { type?: string; name?: string } | null;
}): "audio" | "chat" {
  const mime = String(msg.file?.type || "").toLowerCase();
  const name = String(msg.file?.name || "").toLowerCase();
  const isAudio =
    mime.startsWith("audio/") ||
    /\.(mp3|wav|ogg|m4a|aac|mpeg|webm)$/i.test(name);
  if (msg.fromHead) return isAudio ? "audio" : "chat";
  return msg.type === "file" ? "audio" : "chat";
}

export function applySeenByUpdate<
  T extends {
    fromClient?: boolean;
    fromHead?: boolean;
    fromTeamLeader?: boolean;
    timestamp?: string;
    messageId?: string;
    id?: number;
    seen_by?: string[];
  },
>(
  prev: T[],
  data: {
    fromRole?: string;
    fromClient?: boolean;
    fromHead?: boolean;
    fromTeamLeader?: boolean;
    timestamp?: string;
    messageId?: string;
    index?: number;
    seen_by?: string[];
    viewer?: string;
  },
): T[] {
  const fromClient = data.fromRole ? data.fromRole === "client" : !!data.fromClient;
  const fromHead = data.fromRole ? data.fromRole === "head" : !!data.fromHead;
  const fromTeamLeader = data.fromRole
    ? data.fromRole === "tl"
    : !!data.fromTeamLeader;

  return prev.map((m) => {
    if (
      !!m.fromClient !== fromClient ||
      !!m.fromHead !== fromHead ||
      !!m.fromTeamLeader !== fromTeamLeader
    ) {
      return m;
    }
    if (
      !matchesChatMessage(m, {
        timestamp: data.timestamp,
        messageId: data.messageId,
        index: data.index,
        id: data.index,
      })
    ) {
      return m;
    }
    return {
      ...m,
      seen_by: mergeSeenBy(m.seen_by, data.seen_by, data.viewer ? [data.viewer] : []),
    };
  });
}

const GESTURE_EVENTS = ["pointerdown", "click", "keydown", "touchstart"] as const;

let audioUnlocked = false;
let unlockListenersBound = false;
let notificationAudio: HTMLAudioElement | null = null;

function getNotificationAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!notificationAudio) {
    notificationAudio = new Audio(notificationSoundUrl);
    notificationAudio.preload = "auto";
    notificationAudio.volume = 0.9;
  }
  return notificationAudio;
}

function bindUnlockListeners(): void {
  if (typeof window === "undefined" || unlockListenersBound || audioUnlocked) return;
  unlockListenersBound = true;

  const onGesture = (event: Event) => {
    const target = event.target as HTMLElement | null;
    // Mic click needs the user-gesture for getUserMedia. Do not consume it here.
    if (target && typeof target.closest === "function" && target.closest("[data-mic-record]")) {
      return;
    }
    const audio = getNotificationAudio();
    if (!audio) return;
    audio.muted = true;
    audio.volume = 0.01;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audio.volume = 0.9;
        audioUnlocked = true;
        GESTURE_EVENTS.forEach((eventName) => {
          window.removeEventListener(eventName, onGesture, true);
        });
      })
      .catch(() => {
        audio.muted = false;
        audio.volume = 0.9;
      });
  };

  GESTURE_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, onGesture, { capture: true });
  });
}

/** Pin a chat scroller to the latest bubble (files/images grow after paint). */
export function scrollChatToBottom(el?: HTMLElement | null): void {
  if (!el) return;
  const run = () => {
    el.scrollTop = el.scrollHeight;
  };
  run();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }
  window.setTimeout(run, 80);
  window.setTimeout(run, 280);
  window.setTimeout(run, 700);
}

export function unlockChatNotificationSound(): void {
  if (audioUnlocked) return;
  bindUnlockListeners();
}

export function playChatNotificationSound(): void {
  if (typeof window === "undefined") return;
  if (!audioUnlocked) {
    bindUnlockListeners();
  }

  const audio = getNotificationAudio();
  if (!audio) return;

  try {
    audio.muted = false;
    audio.volume = 0.9;
    audio.currentTime = 0;
    const playResult = audio.play();
    if (playResult && typeof playResult.then === "function") {
      playResult
        .then(() => {
          audioUnlocked = true;
        })
        .catch(() => {
          audioUnlocked = false;
          unlockListenersBound = false;
          bindUnlockListeners();
        });
    } else {
      audioUnlocked = true;
    }
  } catch {
    audioUnlocked = false;
    unlockListenersBound = false;
    bindUnlockListeners();
  }
}

if (typeof window !== "undefined") {
  bindUnlockListeners();
}

export function safeSocketEmit(
  socket: { connected?: boolean; emit: (event: string, data: any) => void; once?: Function } | null | undefined,
  eventName: string,
  data: any,
): void {
  if (!socket) return;
  if (socket.connected) {
    socket.emit(eventName, data);
    return;
  }
  if (typeof socket.once === "function") {
    socket.once("connect", () => socket.emit(eventName, data));
  }
}
