/**
 * Normalize chat/file URLs so images/videos render immediately without a page refresh.
 * Backend stores relative paths like `/files/<id>.png`; the UI must always resolve to an absolute URL.
 */

export function toRelativeFileUrl(
  url: string | undefined | null,
  serverURL: string,
): string {
  if (!url) return "";
  let cleaned = String(url).trim();
  if (!cleaned) return "";

  // Strip absolute backend origin if present
  if (serverURL && cleaned.startsWith(serverURL)) {
    cleaned = cleaned.slice(serverURL.length);
  }

  // Strip accidental double-host prefixes
  cleaned = cleaned.replace(/^https?:\/\/[^/]+/i, "");

  if (!cleaned.startsWith("/")) {
    cleaned = `/${cleaned.replace(/^\/+/, "")}`;
  }
  return cleaned;
}

export function toAbsoluteFileUrl(
  url: string | undefined | null,
  serverURL: string,
): string {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";

  if (
    raw.startsWith("blob:") ||
    raw.startsWith("data:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  const relative = toRelativeFileUrl(raw, serverURL);
  if (!relative) return "";
  return `${serverURL}${relative}`;
}
