import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useChunkedUpload } from "./useChunkedUpload";
import type { UploadTask } from "./upload";
import {
  buildChatFilePayload,
  emitChatFileMessage,
  type ChatUploaderRole,
} from "./chatFileUtils";

export interface ProjectChatFileMessage {
  type: "file";
  isLeft: boolean;
  fromClient?: boolean;
  fromHead?: boolean;
  fromTeamLeader?: boolean;
  fromTL?: boolean;
  timestamp: string;
  seen_by: string[];
  tempId: string;
  file: { name: string; url: string; type: string };
  caption?: string;
  mention?: null;
  replyTo?: any;
  senderId?: string;
  senderName?: string;
  senderPic?: string;
}

interface UseProjectChatFileUploadOptions {
  projectId: string | number | null | undefined;
  role: ChatUploaderRole;
  uploaderId?: string | number | null;
  /** Display name of the uploader (for TL/Employee monitor chat) */
  uploaderName?: string | null;
  uploaderPic?: string | null;
  socket: Socket | null;
  connected: boolean;
  getSocketExtra?: () => Record<string, unknown>;
  onLocalMessage: (msg: ProjectChatFileMessage) => void;
}

/**
 * Role-aware WhatsApp-style chunked upload for Head / Client / TL chat.
 * - Progress bubbles via `uploadTasks`
 * - Single socket emit per completed file (tempId guarded)
 * - projectId stored in task meta for landing-page race safety
 */
export function useProjectChatFileUpload(options: UseProjectChatFileUploadOptions) {
  const {
    projectId,
    role,
    uploaderId,
    uploaderName,
    uploaderPic,
    socket,
    connected,
    getSocketExtra,
    onLocalMessage,
  } = options;

  const [uploadTasks, setUploadTasks] = useState<Record<string, UploadTask>>({});
  const resolvedProjectId = projectId != null ? String(projectId) : "";

  // Keep latest values in refs so long-running chunk loops never go stale
  const socketRef = useRef(socket);
  const connectedRef = useRef(connected);
  const onLocalMessageRef = useRef(onLocalMessage);
  const getSocketExtraRef = useRef(getSocketExtra);
  const uploaderIdRef = useRef(uploaderId);
  const uploaderNameRef = useRef(uploaderName);
  const uploaderPicRef = useRef(uploaderPic);
  const completedTaskIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);
  useEffect(() => {
    onLocalMessageRef.current = onLocalMessage;
  }, [onLocalMessage]);
  useEffect(() => {
    getSocketExtraRef.current = getSocketExtra;
  }, [getSocketExtra]);
  useEffect(() => {
    uploaderIdRef.current = uploaderId;
  }, [uploaderId]);
  useEffect(() => {
    uploaderNameRef.current = uploaderName;
  }, [uploaderName]);
  useEffect(() => {
    uploaderPicRef.current = uploaderPic;
  }, [uploaderPic]);

  const flags = useMemo(() => {
    const isMonitorSide = role === "tl_monitor" || role === "employee";
    return {
      isLeft: false,
      fromClient: role === "client",
      fromHead: role === "head",
      fromTeamLeader: role === "tl",
      fromTL: role === "tl" || role === "tl_monitor",
      ...(isMonitorSide
        ? {
            senderId: uploaderId != null ? String(uploaderId) : undefined,
            senderName: uploaderName || undefined,
            senderPic: uploaderPic || undefined,
          }
        : {}),
    };
  }, [role, uploaderId, uploaderName, uploaderPic]);

  const uploadManager = useChunkedUpload({
    projectId: resolvedProjectId,
    onProgress: (task) => {
      setUploadTasks((prev) => ({ ...prev, [task.id]: task }));
    },
    onComplete: (task, result: any) => {
      // Guard: complete can only apply once per task id
      if (completedTaskIdsRef.current.has(task.id)) {
        console.warn("Skip duplicate onComplete for task", task.id);
        return;
      }
      completedTaskIdsRef.current.add(task.id);

      const payload = result?.data ? result.data : result;
      const built = buildChatFilePayload({
        name: payload?.fileName || payload?.name || task.fileName,
        url: payload?.fileUrl || payload?.url || "",
        type: payload?.fileType || payload?.type || task.fileType,
      });

      setUploadTasks((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });

      const activeProjectId =
        (task.meta?.projectId as string | number | undefined) ||
        resolvedProjectId;

      if (!built.relativeUrl || !built.name || !activeProjectId) {
        console.error("Chunk upload complete but missing file/project data", {
          result,
          activeProjectId,
        });
        return;
      }

      const completedTimestamp = new Date().toISOString();
      const captionMeta = (task.meta?.caption as string | undefined) || undefined;
      const replyMeta = task.meta?.replyTo ?? null;
      const uid = uploaderIdRef.current;

      const uidStr = uid != null ? String(uid) : undefined;
      const nameStr = uploaderNameRef.current || undefined;
      const picStr = uploaderPicRef.current || undefined;

      const localMsg: ProjectChatFileMessage = {
        type: "file",
        ...flags,
        timestamp: completedTimestamp,
        seen_by: [],
        tempId: task.id,
        file: built.file,
        caption: captionMeta,
        mention: null,
        replyTo: replyMeta,
        senderId: uidStr,
        senderName: nameStr,
        senderPic: picStr,
      };

      onLocalMessageRef.current?.(localMsg);

      emitChatFileMessage({
        socket: socketRef.current,
        role,
        projectId: activeProjectId,
        msgData: built.msgData,
        caption: captionMeta || null,
        timestamp: completedTimestamp,
        tempId: task.id,
        replyTo: replyMeta,
        extra: {
          ...(getSocketExtraRef.current?.() || {}),
          headId: role === "head" ? uid || undefined : undefined,
          teamleaderid: role === "tl" ? uid || undefined : undefined,
          // TL ↔ Employee monitor chat
          senderId: uidStr,
          senderName: nameStr,
          senderPic: picStr,
        },
      });
    },
    onError: (task) => {
      setUploadTasks((prev) => ({ ...prev, [task.id]: task }));
    },
    onCancelled: (task) => {
      completedTaskIdsRef.current.delete(task.id);
      setUploadTasks((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    },
  });

  // Stable addFiles handle so parents don't thrash
  const addFilesRef = useRef(uploadManager.addFiles);
  useEffect(() => {
    addFilesRef.current = uploadManager.addFiles;
  }, [uploadManager.addFiles]);

  const addChatFiles = useCallback(
    (
      files: File[],
      meta?: {
        caption?: string;
        replyTo?: unknown;
      },
    ) => {
      if (!resolvedProjectId) {
        console.error("Cannot upload file: projectId is missing");
        alert("Project is still loading. Please wait a moment and try again.");
        return [];
      }
      if (!files.length) return [];

      // Map monitor roles to a generic uploaderRole for chunk init metadata
      const initRole =
        role === "tl_monitor" ? "tl" : role === "employee" ? "employee" : role;

      return addFilesRef.current(files, {
        caption: meta?.caption || "",
        replyTo: meta?.replyTo || null,
        uploaderRole: initRole,
        uploaderId: uploaderId || undefined,
        projectId: resolvedProjectId,
      });
    },
    [resolvedProjectId, role, uploaderId],
  );

  return {
    uploadTasks,
    addChatFiles,
    pause: uploadManager.pause,
    resume: uploadManager.resume,
    cancel: uploadManager.cancel,
    retry: uploadManager.retry,
    canUpload: Boolean(resolvedProjectId),
    connected,
  };
}
