/**
 * Shared identity helpers so Head / Client / TL all treat one physical
 * file/message as a single chat row — live and after refresh.
 */

export type ChatRole = "client" | "head" | "tl";

export function fileUrlKey(url?: string | null): string {
  if (!url) return "";
  try {
    const cleaned = String(url).split("?")[0].split("#")[0];
    const parts = cleaned.split(/[/\\]/);
    return (parts[parts.length - 1] || cleaned).toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

/** Parse a DB chat row that may be an object, JSON string, or double-encoded JSON. */
export function parseChatJson(raw: unknown): Record<string, any> | null {
  if (raw == null) return null;
  let value: any = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return value;
}

export function isSystemChatMessage(parsed: any): boolean {
  return String(parsed?.type || "").toLowerCase() === "system";
}

export function storedChatFileData(
  parsed: any,
): { name?: string; url?: string; type?: string } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const data =
    parsed.data && typeof parsed.data === "object" ? parsed.data : null;
  const file =
    parsed.file && typeof parsed.file === "object" ? parsed.file : null;
  const src = data || file;
  if (!src) return null;
  const name = src.name || src.fileName || src.originalname;
  const url = src.url || src.fileUrl || src.path;
  if (!name && !url) return null;
  return {
    name,
    url,
    type: src.type || src.mimetype,
  };
}

export function resolveRoleFromParsed(
  parsed: any,
  columnDefault: ChatRole,
): ChatRole {
  if (!parsed || typeof parsed !== "object") return columnDefault;

  const roleRaw =
    parsed.fromRole ||
    parsed.senderRole ||
    parsed.role ||
    null;
  if (typeof roleRaw === "string") {
    const r = roleRaw.toLowerCase().trim();
    if (r === "client") return "client";
    if (r === "head") return "head";
    if (r === "tl" || r === "team leader" || r === "teamleader") return "tl";
  }

  if (parsed.fromClient === true) return "client";
  if (parsed.fromHead === true) return "head";
  if (parsed.fromTeamLeader === true || parsed.fromTL === true) return "tl";

  return columnDefault;
}

export function roleFlags(role: ChatRole) {
  return {
    fromClient: role === "client",
    fromHead: role === "head",
    fromTeamLeader: role === "tl",
  };
}

/** isLeft for a given viewer role (own messages on the right). */
export function isLeftForViewer(viewer: ChatRole, sender: ChatRole): boolean {
  return viewer !== sender;
}

const GENERIC_PERSON_NAME =
  /^(unknown\s+)?(team\s*leader|teamleader|tl|head|client|you)$/i;

/** First real person name from mixed API casings / message sender fields. */
export function pickPersonName(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const nested = pickPersonName(
        obj.senderName,
        obj.sendername,
        obj.teamLeaderName,
        obj.teamleadername,
        obj.TeamLeaderName,
        obj.employeeName,
        obj.employeename,
      );
      if (nested) return nested;
      continue;
    }
    const name = String(value).trim();
    if (!name || GENERIC_PERSON_NAME.test(name)) continue;
    return name;
  }
  return "";
}

/** True when a parsed/loaded row would render as an empty chat bubble. */
export function hasVisibleChatContent(msg: {
  isDeleted?: boolean;
  message?: string;
  caption?: string;
  file?: { url?: string; name?: string } | null;
}): boolean {
  if (msg?.isDeleted) return true;
  if (typeof msg?.message === "string" && msg.message.trim()) return true;
  if (typeof msg?.caption === "string" && msg.caption.trim()) return true;
  if (msg?.file?.url && msg?.file?.name) return true;
  return false;
}

/**
 * Collapse duplicates after loading client/head/tl arrays.
 * Same file URL or same messageId = one bubble; prefer explicit fromRole.
 */
export function dedupeLoadedMessages<T extends Record<string, any>>(
  messages: T[],
): T[] {
  type Entry = { msg: T; score: number; index: number };
  const byKey = new Map<string, Entry>();

  messages.forEach((msg, index) => {
    const messageId = msg.messageId || msg.msgId || null;
    const fKey = fileUrlKey(msg.file?.url);
    const key = messageId
      ? `mid:${messageId}`
      : fKey
        ? `file:${fKey}`
        : `ts:${msg.timestamp}|${msg.fromClient ? "c" : ""}${msg.fromHead ? "h" : ""}${msg.fromTeamLeader ? "t" : ""}|${msg.message || msg.file?.name || ""}`;

    // Prefer rows that have messageId / explicit role markers
    let score = 0;
    if (messageId) score += 10;
    if (msg.messageId || msg.fromRole) score += 5;
    if (msg.file?.url) score += 1;

    const existing = byKey.get(key);
    if (!existing || score > existing.score) {
      byKey.set(key, { msg, score, index });
    }
  });

  return Array.from(byKey.values())
    .sort((a, b) => a.index - b.index)
    .map((e) => e.msg)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

/** Keep optimistic/live rows when a REST snapshot would otherwise wipe them. */
export function keepLiveChatRows<T extends Record<string, any>>(
  loaded: T[],
  prev: T[],
): T[] {
  if (loaded.length === 0 && prev.length > 0) return prev;
  const liveOnly = prev.filter((p) => {
    if (!hasVisibleChatContent(p)) return false;
    return !loaded.some((m) => {
      if (p.messageId && m.messageId && String(p.messageId) === String(m.messageId)) {
        return true;
      }
      if (p.tempId && m.tempId && String(p.tempId) === String(m.tempId)) {
        return true;
      }
      const pf = fileUrlKey(p.file?.url);
      const mf = fileUrlKey(m.file?.url);
      if (pf && mf && pf === mf) return true;
      if (
        p.timestamp &&
        m.timestamp &&
        String(p.timestamp) === String(m.timestamp) &&
        (p.message || "") === (m.message || "") &&
        (p.file?.name || "") === (m.file?.name || "")
      ) {
        return true;
      }
      return false;
    });
  });
  return dedupeLoadedMessages([...loaded, ...liveOnly]);
}
