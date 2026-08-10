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
