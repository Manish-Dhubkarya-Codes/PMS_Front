// hooks/useChunkedUpload.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { postData, serverURL } from "../BackendConnections/FetchBackendServices";
import type { ChunkUploadResponse, CompleteUploadResponse, InitUploadResponse, UploadManagerOptions, UploadTask } from "./upload";

const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
const MIN_CHUNK_SIZE = 256 * 1024; // 256KB for tiny files -> smoother % updates
const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB cap so a single chunk XHR isn't huge
const DEFAULT_MAX_CONCURRENT_FILES = 3;
const DEFAULT_MAX_CHUNK_RETRIES = 4;
const RESUME_CACHE_PREFIX = "wa_upload_resume:";

function pickChunkSize(fileSize: number, requested?: number): number {
  if (requested) return Math.min(Math.max(requested, MIN_CHUNK_SIZE), MAX_CHUNK_SIZE);
  if (fileSize <= MIN_CHUNK_SIZE) return fileSize || MIN_CHUNK_SIZE;
  return Math.min(Math.max(Math.ceil(fileSize / 200), MIN_CHUNK_SIZE), DEFAULT_CHUNK_SIZE);
}

function fingerprint(file: File) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function backoffMs(attempt: number) {
  return Math.min(1000 * 2 ** attempt, 15000);
}

function getUploaderMeta(taskMeta?: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return { uploaderRole: undefined, uploaderId: undefined };
  }

  const storedUserData = localStorage.getItem("userData");
  const storedRole = localStorage.getItem("role");
  const parsedUserData = storedUserData
    ? JSON.parse(atob(storedUserData))
    : null;
  const roleString = storedRole ? atob(storedRole) : undefined;

  const metaRole = taskMeta?.uploaderRole as string | undefined;
  const metaId = taskMeta?.uploaderId as string | number | undefined;

  const uploaderRole = metaRole
    ? metaRole
    : roleString
    ? roleString === "Head"
      ? "head"
      : roleString === "Client"
      ? "client"
      : roleString === "Team Leader"
      ? "tl"
      : roleString === "Employee"
      ? "employee"
      : roleString.toLowerCase()
    : undefined;

  const uploaderId =
    metaId !== undefined && metaId !== null
      ? String(metaId)
      : parsedUserData?.headId ||
        parsedUserData?.clientId ||
        parsedUserData?.employeeId ||
        parsedUserData?.teamLeaderId ||
        parsedUserData?.id ||
        parsedUserData?.userId ||
        undefined;

  return { uploaderRole, uploaderId };
}

/** Small helper: posts a chunk with real upload-progress events via XHR (fetch doesn't
 * give reliable upload progress across browsers), and returns an abort handle. */
function uploadChunkXHR(
  url: string,
  formData: FormData,
  onProgress: (loadedThisChunk: number) => void
): { promise: Promise<ChunkUploadResponse>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<ChunkUploadResponse>((resolve, reject) => {
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Malformed server response"));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.send(formData);
  });
  return { promise, abort: () => xhr.abort() };
}

export function useChunkedUpload(options: UploadManagerOptions) {
  const {
    projectId,
    maxConcurrentFiles = DEFAULT_MAX_CONCURRENT_FILES,
    chunkSize,
    maxChunkRetries = DEFAULT_MAX_CHUNK_RETRIES,
    onProgress,
    onComplete,
    onError,
    onCancelled,
  } = options;

  // Rendered mirror of task state (for React) ...
  const [tasks, setTasks] = useState<Record<string, UploadTask>>({});
  // ... backed by refs so the async chunk loop always sees fresh, non-stale data.
  const tasksRef = useRef<Record<string, UploadTask>>({});
  const projectIdRef = useRef(projectId);
  const abortersRef = useRef<Record<string, () => void>>({});
  const speedSamplesRef = useRef<Record<string, { t: number; bytes: number }[]>>({});
  const runningCountRef = useRef(0);
  // Keep callbacks in refs so long-running upload loops never call a stale
  // onComplete/onProgress from the first render (missing socket / projectId).
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onCancelledRef = useRef(onCancelled);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onCancelledRef.current = onCancelled;
  }, [onCancelled]);

  const patchTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    tasksRef.current = {
      ...tasksRef.current,
      [id]: { ...tasksRef.current[id], ...patch },
    };
    setTasks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    return tasksRef.current[id];
  }, []);

  const recordSpeedSample = (id: string, uploadedBytes: number) => {
    const now = performance.now();
    const samples = speedSamplesRef.current[id] || [];
    samples.push({ t: now, bytes: uploadedBytes });
    // keep a ~4s rolling window
    while (samples.length > 1 && now - samples[0].t > 4000) samples.shift();
    speedSamplesRef.current[id] = samples;
    if (samples.length < 2) return { speed: 0, eta: null as number | null };
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    const db = last.bytes - first.bytes;
    const speed = dt > 0 ? db / dt : 0;
    const task = tasksRef.current[id];
    const remaining = task ? task.totalBytes - uploadedBytes : 0;
    const eta = speed > 0 ? remaining / speed : null;
    return { speed, eta };
  };

  // ---------- server calls (adjust to match your real API) ----------

const initUpload = async (task: UploadTask): Promise<InitUploadResponse> => {
  const activeProjectId = projectIdRef.current?.toString().trim();
  if (!activeProjectId || activeProjectId === "undefined" || activeProjectId === "null") {
    throw new Error("Project ID is missing. Please refresh the page and try again.");
  }

  const { uploaderRole, uploaderId } = getUploaderMeta(task.meta);

  return await postData("clientproject/upload_init", {
    projectId: activeProjectId,
    fileName: task.fileName,
    fileSize: task.totalBytes,
    fileType: task.fileType,
    totalChunks: task.totalChunks,
    chunkSize: task.chunkSize,
    resumeKey: fingerprint(task.file),
    uploaderRole,
    uploaderId,
    caption: task.meta?.caption || null,
  });
};

  const uploadOneChunk = (task: UploadTask, chunkIndex: number) => {
    const start = chunkIndex * task.chunkSize;
    const end = Math.min(start + task.chunkSize, task.totalBytes);
    const blob = task.file.slice(start, end);
    const formData = new FormData();
    formData.append("uploadId", task.serverUploadId as string);
    formData.append("chunkIndex", String(chunkIndex));
    formData.append("totalChunks", String(task.totalChunks));
    formData.append("chunk", blob, task.fileName);

    const { uploaderRole, uploaderId } = getUploaderMeta(task.meta);
    if (uploaderRole) formData.append("uploaderRole", uploaderRole);
    if (uploaderId) formData.append("uploaderId", String(uploaderId));

    const bytesBeforeThisChunk = start;
    return uploadChunkXHR(
      `${serverURL}/clientproject/upload_chunk`,
      formData,
      (loadedThisChunk) => {
        const uploadedBytes = bytesBeforeThisChunk + loadedThisChunk;
        const { speed, eta } = recordSpeedSample(task.id, uploadedBytes);
        const progress = Math.min(99, Math.round((uploadedBytes / task.totalBytes) * 100));
        const updated = patchTask(task.id, {
          uploadedBytes,
          progress,
          speedBytesPerSec: speed,
          etaSeconds: eta,
        });
        onProgressRef.current?.(updated);
      },
    );
  };

  const completeUpload = async (
    task: UploadTask
  ): Promise<CompleteUploadResponse> => {
    const activeProjectId = projectIdRef.current?.toString().trim();
    if (!activeProjectId || activeProjectId === "undefined" || activeProjectId === "null") {
      throw new Error("Project ID is missing. Please refresh the page and try again.");
    }

    const { uploaderRole, uploaderId } = getUploaderMeta(task.meta);

    return await postData("clientproject/upload_complete", {
      projectId: activeProjectId,
      uploadId: task.serverUploadId,
      uploaderRole,
      uploaderId,
    });
  };

  const cancelOnServer = async (
    uploadId?: string,
    taskMeta?: Record<string, unknown>,
  ) => {
    if (!uploadId) return;

    const activeProjectId = projectIdRef.current?.toString().trim();
    if (!activeProjectId || activeProjectId === "undefined" || activeProjectId === "null") return;

    const { uploaderRole, uploaderId } = getUploaderMeta(taskMeta);

    await postData("clientproject/upload_cancel", {
      projectId: activeProjectId,
      uploadId,
      uploaderRole,
      uploaderId,
    });
  };


  // ---------- concurrency queue ----------

  const tryStartQueued = useCallback(() => {
    if (runningCountRef.current >= maxConcurrentFiles) return;
    const next = Object.values(tasksRef.current).find((t) => t.status === "queued");
    if (!next) return;
    runningCountRef.current += 1;
    patchTask(next.id, { status: "uploading" });
    void runUploadLoop(next.id);
  }, [maxConcurrentFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishRunningSlot = () => {
    runningCountRef.current = Math.max(0, runningCountRef.current - 1);
    // let the microtask queue settle status writes before pulling the next one
    setTimeout(tryStartQueued, 0);
  };

  // ---------- the per-file chunk loop ----------

  const runUploadLoop = async (id: string) => {
    let task = tasksRef.current[id];
    if (!task) return finishRunningSlot();

    try {
      if (!task.serverUploadId) {
        const cachedRaw = localStorage.getItem(RESUME_CACHE_PREFIX + fingerprint(task.file));
        const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
        const init = await initUpload(task);
        if (!init || typeof init !== "object") throw new Error("Could not start upload");
        if (!init.status) throw new Error(init.message || "Could not start upload");

        const resumedFromCache =
          cached?.uploadId === init.uploadId ? cached : null;
        const received = new Set(init.receivedChunks || resumedFromCache?.receivedChunks || []);
        let nextIdx = 0;
        while (received.has(nextIdx)) nextIdx++;
        const uploadedBytes = Math.min(nextIdx * task.chunkSize, task.totalBytes);

        task = patchTask(id, {
          serverUploadId: init.uploadId,
          nextChunkIndex: nextIdx,
          uploadedBytes,
          progress: Math.round((uploadedBytes / task.totalBytes) * 100),
        });
      }

      while (task.nextChunkIndex < task.totalChunks) {
        // status may have flipped to 'paused' or 'cancelled' between iterations
        task = tasksRef.current[id];
        if (!task || task.status === "paused" || task.status === "cancelled") {
          // Do NOT finishRunningSlot here — the finally block always does it once.
          // Calling it here AND in finally was double-decrementing and could start
          // two queued uploads for a single freed slot (looked like "double send").
          return;
        }

        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            const { promise, abort } = uploadOneChunk(task, task.nextChunkIndex);
            abortersRef.current[id] = abort;
            const result = await promise;
            delete abortersRef.current[id];
            if (!result.status) throw new Error(result.message || "Chunk rejected");

            const persistedBytes = Math.min((task.nextChunkIndex + 1) * task.chunkSize, task.totalBytes);
            task = patchTask(id, {
              nextChunkIndex: task.nextChunkIndex + 1,
              uploadedBytes: persistedBytes,
              progress: Math.min(99, Math.round((persistedBytes / task.totalBytes) * 100)),
              error: undefined,
            });
            localStorage.setItem(
              RESUME_CACHE_PREFIX + fingerprint(task.file),
              JSON.stringify({
                uploadId: task.serverUploadId,
                receivedChunks: Array.from({ length: task.nextChunkIndex }, (_, i) => i),
              })
            );
            break; // chunk succeeded, move to next
          } catch (err: unknown) {
            delete abortersRef.current[id];
            const errorMessage = err instanceof Error ? err.message : "Upload failed";
            if (errorMessage === "AbortError" || (err instanceof DOMException && err.name === "AbortError")) {
              // paused/cancelled — finally frees the concurrency slot once
              return;
            }
            attempt += 1;
            if (attempt > maxChunkRetries) {
              const failed = patchTask(id, {
                status: "error",
                error: errorMessage,
              });
              onErrorRef.current?.(failed, failed.error || "Upload failed");
              return; // finally frees slot once
            }
            await new Promise((r) => setTimeout(r, backoffMs(attempt)));
          }
        }
      }

      // all chunks acknowledged -> finalize on server
      const done = await completeUpload(task);
      if (!done || !done.status) throw new Error(done?.message || "Could not finalize upload");
      localStorage.removeItem(RESUME_CACHE_PREFIX + fingerprint(task.file));
      const finalTask = patchTask(id, { status: "completed", progress: 100, uploadedBytes: task.totalBytes });
      // Keep previewUrl until UI replaces with completed bubble; revoke only if still set
      if (task.previewUrl) {
        // Delay revoke slightly so React can paint the final message first
        const url = task.previewUrl;
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      onCompleteRef.current?.(finalTask, done);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      const failed = patchTask(id, { status: "error", error: errorMessage });
      onErrorRef.current?.(failed, failed.error || "Upload failed");
    } finally {
      finishRunningSlot();
    }
  };

  // ---------- public controls ----------

  const addFiles = useCallback(
    (files: File[], meta?: Record<string, unknown>) => {
      const created: UploadTask[] = files.map((file) => {
        const id = uuidv4();
        const cSize = pickChunkSize(file.size, chunkSize);
        const totalChunks = Math.max(1, Math.ceil(file.size / cSize));
        const isPreviewable = file.type.startsWith("image/") || file.type.startsWith("video/");
        const task: UploadTask = {
          id,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
          previewUrl: isPreviewable ? URL.createObjectURL(file) : undefined,
          status: "queued",
          uploadedBytes: 0,
          totalBytes: file.size,
          progress: 0,
          speedBytesPerSec: 0,
          etaSeconds: null,
          chunkSize: cSize,
          totalChunks,
          nextChunkIndex: 0,
          meta,
        };
        return task;
      });

      setTasks((prev) => {
        const next = { ...prev };
        created.forEach((t) => (next[t.id] = t));
        tasksRef.current = next;
        return next;
      });
      // kick the queue on next tick so state has committed
      setTimeout(() => created.forEach(tryStartQueued), 0);
      return created;
    },
    [chunkSize, tryStartQueued]
  );

  const pause = useCallback(
    (id: string) => {
      const task = tasksRef.current[id];
      if (!task || task.status !== "uploading") return;
      patchTask(id, { status: "paused" });
      abortersRef.current[id]?.();
    },
    [patchTask]
  );

  const resume = useCallback(
    (id: string) => {
      const task = tasksRef.current[id];
      if (!task || (task.status !== "paused" && task.status !== "error")) return;
      if (runningCountRef.current >= maxConcurrentFiles) {
        patchTask(id, { status: "queued", error: undefined });
        return;
      }
      runningCountRef.current += 1;
      patchTask(id, { status: "uploading", error: undefined });
      void runUploadLoop(id);
    },
    [maxConcurrentFiles, patchTask] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const retry = useCallback((id: string) => resume(id), [resume]);

  const cancel = useCallback(
    (id: string) => {
      const task = tasksRef.current[id];
      if (!task) return;
      abortersRef.current[id]?.();
      delete abortersRef.current[id];
      cancelOnServer(task.serverUploadId, task.meta);
      localStorage.removeItem(RESUME_CACHE_PREFIX + fingerprint(task.file));
      if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
      const cancelled = patchTask(id, { status: "cancelled" });
      onCancelledRef.current?.(cancelled);
      setTasks((prev) => {
        const next = { ...prev };
        delete next[id];
        tasksRef.current = next;
        return next;
      });
    },
    [patchTask]
  );

  const remove = useCallback((id: string) => {
    setTasks((prev) => {
      const next = { ...prev };
      delete next[id];
      tasksRef.current = next;
      return next;
    });
  }, []);

  // Abort any in-flight requests if the component unmounts mid-upload.
  useEffect(() => {
    return () => {
      Object.values(abortersRef.current).forEach((abort) => abort());
    };
  }, []);

  return {
    tasks, // Record<id, UploadTask> - render as a list with Object.values(tasks)
    addFiles,
    pause,
    resume,
    retry,
    cancel,
    remove,
  };
}

export type UseChunkedUpload = ReturnType<typeof useChunkedUpload>;