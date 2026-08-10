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
  fromClient: boolean;
  fromHead: boolean;
  fromTeamLeader: boolean;
  timestamp: string;
  seen_by: string[];
  tempId: string;
  file: { name: string; url: string; type: string };
  caption?: string;
  mention: null;
  replyTo?: any;
}

interface UseProjectChatFileUploadOptions {
  projectId: string | number | null | undefined;
  role: ChatUploaderRole;
  uploaderId?: string | number | null;
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

  const flags = useMemo(
    () => ({
      isLeft: false,
      fromClient: role === "client",
      fromHead: role === "head",
      fromTeamLeader: role === "tl",
    }),
    [role],
  );

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

      return addFilesRef.current(files, {
        caption: meta?.caption || "",
        replyTo: meta?.replyTo || null,
        uploaderRole: role,
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
