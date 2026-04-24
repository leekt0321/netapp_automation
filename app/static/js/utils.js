import { DESKTOP_LOG_MEDIA_QUERY, MANUAL_FIELD_KEYS } from "/static/js/constants.js";

export function getStatusBadgeClass(status) {
  if (status === "완료") {
    return "done";
  }
  if (status === "진행중") {
    return "doing";
  }
  return "wait";
}

export function formatBytes(bytes) {
  if (bytes === 0 || bytes === null || bytes === undefined) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return value.toFixed(value >= 10 || index === 0 ? 0 : 1) + " " + units[index];
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toStorageLabel(storageKey) {
  if (storageKey === "storage1") {
    return "스토리지1팀";
  }
  if (storageKey === "storage2") {
    return "스토리지2팀";
  }
  if (storageKey === "storage3") {
    return "스토리지3팀";
  }
  return storageKey || "-";
}

export function createEmptyManualFields() {
  const fields = {};
  for (const key of MANUAL_FIELD_KEYS) {
    fields[key] = "";
  }
  return fields;
}

export function isDesktopLogSplitView() {
  return window.matchMedia(DESKTOP_LOG_MEDIA_QUERY).matches;
}

export function debounce(callback, delayMs) {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      callback(...args);
    }, delayMs);
  };
}
