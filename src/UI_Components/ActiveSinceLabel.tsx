import React from "react";

export function formatActiveSinceDate(value?: string | Date | null): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} /.test(raw) ? raw.replace(" ", "T") : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function isCompletedProjectStatus(status?: string | null): boolean {
  return String(status || "").trim().toLowerCase() === "completed";
}

const ActiveSinceLabel: React.FC<{
  activeDate?: string | Date | null;
  status?: string | null;
  className?: string;
}> = ({ activeDate, status, className = "mt-1" }) => {
  const formatted = formatActiveSinceDate(activeDate);
  if (!formatted || isCompletedProjectStatus(status)) return null;

  return (
    <div className={`flex items-center gap-2 text-[12px] ${className}`}>
      <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-100">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
      </div>
      <span className="text-emerald-700 font-medium tracking-tight">
        Active since {formatted}
      </span>
    </div>
  );
};

export default ActiveSinceLabel;
