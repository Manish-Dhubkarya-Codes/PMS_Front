// components/FileUploadBubble.tsx — WhatsApp-style outgoing upload bubble
import React from "react";
import {
  FaFileAudio,
  FaFileImage,
  FaFileInvoice,
  FaFileVideo,
  FaFileArchive,
} from "react-icons/fa";
import { FaFilePdf, FaFileWord } from "react-icons/fa6";
import { FiPause, FiPlay, FiX, FiRefreshCw, FiAlertCircle } from "react-icons/fi";
import UploadProgressRing from "./UploadProgressRing";
import type { UploadTask } from "./upload";
import { normalizeMimeType } from "./chatFileUtils";

function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 10 ? 0 : 1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number) {
  if (!bytesPerSec || bytesPerSec < 1) return null;
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number | null) {
  if (seconds === null || !isFinite(seconds)) return null;
  if (seconds < 1) return "<1s left";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s left`;
}

function fileIconFor(fileType: string) {
  if (fileType.startsWith("audio/")) return { Icon: FaFileAudio, color: "text-orange-500" };
  if (fileType.startsWith("image/")) return { Icon: FaFileImage, color: "text-emerald-500" };
  if (fileType.startsWith("video/")) return { Icon: FaFileVideo, color: "text-violet-500" };
  if (fileType === "application/pdf") return { Icon: FaFilePdf, color: "text-rose-500" };
  if (fileType.includes("word")) return { Icon: FaFileWord, color: "text-sky-600" };
  if (fileType === "application/zip") return { Icon: FaFileArchive, color: "text-amber-500" };
  return { Icon: FaFileInvoice, color: "text-slate-600" };
}

interface Props {
  task: UploadTask;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  align?: "left" | "right";
}

/**
 * WhatsApp-style outgoing upload bubble with:
 * - large image/video thumbnail + circular progress overlay
 * - compact row for documents with progress ring
 * - pause / resume / cancel / retry
 */
const FileUploadBubble: React.FC<Props> = ({
  task,
  onPause,
  onResume,
  onCancel,
  onRetry,
  align = "right",
}) => {
  const mime = normalizeMimeType(task.fileType, task.fileName);
  const { Icon, color } = fileIconFor(mime);
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const speedLabel = formatSpeed(task.speedBytesPerSec);
  const etaLabel = formatEta(task.etaSeconds);
  const canToggle = task.status === "uploading" || task.status === "paused" || task.status === "queued";

  // ---------- WhatsApp-like media card ----------
  if ((isImage || isVideo) && task.previewUrl) {
    return (
      <div
        className={`relative mt-1 max-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-amber-200 ${
          align === "right" ? "ml-auto" : ""
        }`}
      >
        <div className="relative aspect-video w-full bg-slate-100">
          {isImage ? (
            <img
              src={task.previewUrl}
              alt={task.fileName}
              className={`h-full w-full object-cover ${
                task.status === "uploading" || task.status === "queued" ? "opacity-70" : "opacity-90"
              }`}
            />
          ) : (
            <video
              src={task.previewUrl}
              className="h-full w-full object-cover opacity-70"
              muted
              playsInline
            />
          )}

          {/* Center circular progress — WhatsApp style */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <button
              type="button"
              aria-label={task.status === "uploading" ? "Pause upload" : "Resume upload"}
              disabled={!canToggle && task.status !== "error"}
              onClick={() => {
                if (task.status === "uploading") onPause(task.id);
                else if (task.status === "paused" || task.status === "queued" || task.status === "error")
                  onResume(task.id);
              }}
              className="rounded-full bg-black/45 p-1 backdrop-blur-sm transition hover:bg-black/55"
            >
              <UploadProgressRing
                progress={task.progress}
                size={56}
                strokeWidth={3.5}
                trackColor="rgba(255,255,255,0.35)"
                progressColor="#ffffff"
              >
                <RingCenterIcon task={task} light />
              </UploadProgressRing>
            </button>
          </div>

          {/* Cancel */}
          <button
            type="button"
            aria-label="Cancel upload"
            onClick={() => onCancel(task.id)}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-red-500/80"
          >
            <FiX size={14} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-slate-800">{task.fileName}</p>
            <UploadStatusLine task={task} speedLabel={speedLabel} etaLabel={etaLabel} />
          </div>
          {task.status === "error" && (
            <button
              type="button"
              onClick={() => onRetry(task.id)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-600"
            >
              <FiRefreshCw size={11} /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- Compact document / audio row ----------
  return (
    <div
      className={`relative mt-1 h-fit max-w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-amber-200 transition-all duration-300 ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          aria-label={task.status === "uploading" ? "Pause upload" : "Resume upload"}
          onClick={() => (task.status === "uploading" ? onPause(task.id) : onResume(task.id))}
          disabled={task.status === "completed" || task.status === "error"}
          className="relative shrink-0"
        >
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 ${color}`}>
            <UploadProgressRing progress={task.progress} size={44} strokeWidth={3}>
              <RingCenterIcon task={task} fallback={<Icon size={16} />} />
            </UploadProgressRing>
          </div>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800">{task.fileName}</p>
          <UploadStatusLine task={task} speedLabel={speedLabel} etaLabel={etaLabel} />
        </div>

        <button
          type="button"
          aria-label="Cancel upload"
          onClick={() => onCancel(task.id)}
          className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
        >
          <FiX size={15} />
        </button>
      </div>

      {task.status === "error" && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-red-50/60 px-3 py-1.5">
          <span className="flex items-center gap-1 text-[11px] text-red-600">
            <FiAlertCircle size={12} />
            {task.error || "Upload failed"}
          </span>
          <button
            type="button"
            onClick={() => onRetry(task.id)}
            className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-200"
          >
            <FiRefreshCw size={11} /> Retry
          </button>
        </div>
      )}
    </div>
  );
};

const RingCenterIcon: React.FC<{
  task: UploadTask;
  fallback?: React.ReactNode;
  light?: boolean;
}> = ({ task, fallback, light }) => {
  const cls = light ? "text-white" : "text-slate-700";
  if (task.status === "paused") return <FiPlay size={16} className={cls} />;
  if (task.status === "uploading") return <FiPause size={15} className={cls} />;
  if (task.status === "error") return <FiAlertCircle size={16} className="text-red-400" />;
  if (task.status === "queued")
    return <span className={`text-[9px] font-semibold ${light ? "text-white/90" : "text-slate-500"}`}>wait</span>;
  return <>{fallback ?? null}</>;
};

const UploadStatusLine: React.FC<{
  task: UploadTask;
  speedLabel: string | null;
  etaLabel: string | null;
}> = ({ task, speedLabel, etaLabel }) => {
  if (task.status === "queued") {
    return <p className="text-[10px] uppercase tracking-wide text-slate-400">Waiting to upload…</p>;
  }
  if (task.status === "error") {
    return <p className="text-[10px] uppercase tracking-wide text-red-400">Upload failed</p>;
  }
  const sizeLine = `${formatBytes(task.uploadedBytes)} / ${formatBytes(task.totalBytes)}`;
  const extras = [speedLabel, etaLabel].filter(Boolean).join(" · ");
  return (
    <p className="truncate text-[10px] text-slate-400">
      {task.status === "paused" ? "Paused · " : ""}
      {sizeLine}
      {extras ? ` · ${extras}` : ""}
      {task.status !== "paused" && ` · ${task.progress}%`}
    </p>
  );
};

export default FileUploadBubble;
