import notificationSoundUrl from "../assets/CredientialAssets/Chat_Notification_Sound.mp3";

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
