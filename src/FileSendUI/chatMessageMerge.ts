import { buildChatFilePayload } from "./chatFileUtils";
import {
  fileUrlKey,
  hasVisibleChatContent,
  isLeftForViewer,
  isSystemChatMessage,
  pickPersonName,
  type ChatRole,
} from "./chatIdentity";
import { mergeSeenBy } from "../utils/chatLive";

function sameFile(aUrl?: string, bUrl?: string): boolean {
  const ka = fileUrlKey(aUrl);
  const kb = fileUrlKey(bUrl);
  return Boolean(ka && kb && ka === kb);
}

/**
 * Merge an incoming socket / ack message into local chat state without duplicates.
 */
export function mergeIncomingChatMessage<T extends Record<string, any>>(
  prev: T[],
  data: { fromRole?: string; msg: any },
  options: {
    ownRole: ChatRole;
  },
): T[] {
  const incoming = data?.msg;
  if (!incoming) return prev;
  if (isSystemChatMessage(incoming)) return prev;

  const fromRole = ((): ChatRole => {
    const r =
      data.fromRole ||
      incoming.fromRole ||
      (incoming.fromClient
        ? "client"
        : incoming.fromHead
          ? "head"
          : incoming.fromTeamLeader || incoming.fromTL
            ? "tl"
            : null);
    if (r === "client" || r === "head" || r === "tl") return r;
    return "client";
  })();

  // const incomingIsFile = incoming.type !== "text" && incoming.type !== undefined
  //   ? incoming.type !== "text"
  //   : Boolean(incoming.data?.url || incoming.file?.url);
  const isFile =
    incoming.type === "file" ||
    (incoming.type !== "text" &&
      (incoming.data?.url || incoming.file?.url || incoming.type === "audio"));

  const incomingFileName =
    incoming.data?.originalName ||
    incoming.data?.originalname ||
    incoming.data?.name ||
    incoming.file?.name ||
    undefined;
  const incomingFileUrl =
    incoming.data?.url || incoming.file?.url || undefined;
  const incomingText =
    incoming.type === "text" || (!isFile && typeof incoming.data === "string")
      ? incoming.data || incoming.message
      : undefined;
  const incomingMessageId =
    incoming.messageId || incoming.msgId || undefined;
  const incomingTempId = incoming.tempId || undefined;

  // 1) Upgrade by tempId (optimistic local row)
  if (incomingTempId) {
    const idx = prev.findIndex(
      (m) => m.tempId && m.tempId === incomingTempId,
    );
    if (idx !== -1) {
      return upgradeAt(prev, idx, incoming, fromRole, options.ownRole, {
        isFile,
        incomingFileName,
        incomingFileUrl,
        incomingText,
        incomingMessageId,
      });
    }
  }

  // 2) Upgrade by stable messageId
  if (incomingMessageId) {
    const idx = prev.findIndex(
      (m) => m.messageId && m.messageId === incomingMessageId,
    );
    if (idx !== -1) {
      return upgradeAt(prev, idx, incoming, fromRole, options.ownRole, {
        isFile,
        incomingFileName,
        incomingFileUrl,
        incomingText,
        incomingMessageId,
      });
    }
  }

  // 3) Same physical file (unique server filename) already present
  if (isFile && incomingFileUrl) {
    const idx = prev.findIndex(
      (m) => m.type === "file" && sameFile(m.file?.url, incomingFileUrl),
    );
    if (idx !== -1) {
      return upgradeAt(prev, idx, incoming, fromRole, options.ownRole, {
        isFile,
        incomingFileName,
        incomingFileUrl,
        incomingText,
        incomingMessageId,
      });
    }
  }

  // 4) Exact timestamp + content duplicate
  const isDuplicate = prev.some((m) => {
    if (m.timestamp !== incoming.timestamp) return false;
    if (!isFile) {
      return m.type === "text" && m.message === incomingText;
    }
    return (
      m.type === "file" &&
      (m.file?.name === incomingFileName ||
        sameFile(m.file?.url, incomingFileUrl))
    );
  });
  if (isDuplicate) return prev;

  // 5) Recent optimistic same-name file (tempId lost)
  if (isFile && incomingFileName) {
    const recentIdx = prev.findIndex((m) => {
      if (m.type !== "file" || !m.tempId) return false;
      if (m.file?.name !== incomingFileName) return false;
      const dt = Math.abs(
        new Date(m.timestamp).getTime() -
          new Date(incoming.timestamp || 0).getTime(),
      );
      return dt < 2 * 60 * 1000;
    });
    if (recentIdx !== -1) {
      return upgradeAt(prev, recentIdx, incoming, fromRole, options.ownRole, {
        isFile,
        incomingFileName,
        incomingFileUrl,
        incomingText,
        incomingMessageId,
      });
    }
  }

  // 6) Brand-new message from another user (or ack without local optimistic)
  const fromClient = fromRole === "client";
  const fromHead = fromRole === "head";
  const fromTeamLeader = fromRole === "tl";

  const newMsg: any = {
    type: isFile ? "file" : "text",
    isLeft: isLeftForViewer(options.ownRole, fromRole),
    fromClient,
    fromHead,
    fromTeamLeader,
    timestamp: incoming.timestamp || new Date().toISOString(),
    seen_by: incoming.seen_by || [],
    id: incoming.id,
    messageId: incomingMessageId,
    mention: incoming.mention || null,
    replyTo: incoming.replyTo || null,
    caption: incoming.caption || undefined,
    edited: !!incoming.edited,
    editedAt: incoming.editedAt,
    isDeleted: !!incoming.isDeleted,
    deletedAt: incoming.deletedAt,
    senderName: pickPersonName(incoming),
    // Keep tempId only if still provisional (shouldn't for server msgs)
    tempId: undefined,
  };

  if (!isFile) {
    newMsg.message = incomingText;
  } else if (incomingFileUrl || incomingFileName) {
    newMsg.file = buildChatFilePayload({
      name: incomingFileName,
      originalName: incomingFileName,
      url: incomingFileUrl,
      type: incoming.data?.type || incoming.file?.type,
    }).file;
  }

  if (!hasVisibleChatContent(newMsg)) return prev;

  return [...prev, newMsg as T].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  );
}

function upgradeAt<T extends Record<string, any>>(
  prev: T[],
  idx: number,
  incoming: any,
  fromRole: ChatRole,
  ownRole: ChatRole,
  meta: {
    isFile: boolean;
    incomingFileName?: string;
    incomingFileUrl?: string;
    incomingText?: any;
    incomingMessageId?: string;
  },
): T[] {
  const existing = prev[idx];
  const next = [...prev];
  const upgradedFile = meta.isFile
    ? buildChatFilePayload({
        name: meta.incomingFileName || existing.file?.name,
        url: meta.incomingFileUrl || existing.file?.url,
        type: incoming.data?.type || existing.file?.type,
      }).file
    : existing.file;

  const flags = {
    fromClient: fromRole === "client",
    fromHead: fromRole === "head",
    fromTeamLeader: fromRole === "tl",
  };

  next[idx] = {
    ...existing,
    ...flags,
    isLeft: isLeftForViewer(ownRole, fromRole),
    id: incoming.id ?? existing.id,
    messageId: meta.incomingMessageId || existing.messageId,
    timestamp: incoming.timestamp || existing.timestamp,
    seen_by: mergeSeenBy(existing.seen_by, incoming.seen_by),
    caption: existing.caption || incoming.caption || undefined,
    replyTo: existing.replyTo || incoming.replyTo || null,
    edited: incoming.edited ?? existing.edited,
    editedAt: incoming.editedAt || existing.editedAt,
    isDeleted: incoming.isDeleted ?? existing.isDeleted,
    deletedAt: incoming.deletedAt || existing.deletedAt,
    senderName: pickPersonName(incoming, existing) || existing.senderName,
    tempId: undefined,
    ...(upgradedFile ? { file: upgradedFile } : {}),
    ...(meta.incomingText !== undefined && !meta.isFile
      ? { message: meta.incomingText }
      : {}),
  };
  return next;
}

/** Insert a local completed file message without duplicating. */
export function appendLocalFileMessage<T extends Record<string, any>>(
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
    return (
      m.type === "file" &&
      m.timestamp === msg.timestamp &&
      m.file?.name === (msg as any).file?.name
    );
  });
  if (already) return prev;
  return [...prev, msg].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  );
}
