// types/upload.ts
// Shared types for the WhatsApp-style chunked/resumable upload system.

export type UploadStatus =
  | "queued"      // created, waiting for a concurrency slot
  | "uploading"   // actively sending chunks
  | "paused"      // user paused, safe to resume from nextChunkIndex
  | "error"       // a chunk failed after retries; user can hit Retry
  | "completed"   // server has all chunks and returned the final file
  | "cancelled";  // user cancelled; server-side partial data purged

export interface UploadTask {
  /** Stable id used everywhere: chat tempId, DOM keys, manager map key. */
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  fileType: string;
  /** Local object URL for instant image/video thumbnails. Revoked on cleanup. */
  previewUrl?: string;

  status: UploadStatus;
  uploadedBytes: number;
  totalBytes: number;
  progress: number; // 0-100, derived but cached for render convenience

  speedBytesPerSec: number;
  etaSeconds: number | null;
  error?: string;

  chunkSize: number;
  totalChunks: number;
  nextChunkIndex: number;

  /** Returned by the server on init; identifies this upload session server-side. */
  serverUploadId?: string;

  /** Arbitrary metadata the caller wants carried through to onComplete (caption, replyTo, etc). */
  meta?: Record<string, unknown>;
}

export interface UploadManagerOptions {
  projectId: string;
  /** Max number of files uploading in parallel. Extra files sit in 'queued'. */
  maxConcurrentFiles?: number;
  /** Target bytes per chunk. Actual chunk size is clamped per-file. */
  chunkSize?: number;
  /** Max automatic retries for a single chunk before surfacing an 'error' state. */
  maxChunkRetries?: number;
  onProgress?: (task: UploadTask) => void;
  onComplete?: (task: UploadTask, result: { fileUrl: string; fileName: string; fileType: string }) => void;
  onError?: (task: UploadTask, error: string) => void;
  onCancelled?: (task: UploadTask) => void;
}

export interface ChunkUploadResponse {
  status: boolean;
  receivedChunkIndex: number;
  receivedBytes: number;
  message?: string;
}

export interface InitUploadResponse {
  status: boolean;
  uploadId: string;
  /** Chunk indices the server already has, for resuming a previously-started upload. */
  receivedChunks?: number[];
  message?: string;
}

export interface CompleteUploadResponse {
  status: boolean;
  fileUrl: string;
  fileName: string;
  fileType: string;
  message?: string;
}