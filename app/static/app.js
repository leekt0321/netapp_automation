const form = document.getElementById("upload-form");
const fileInput = document.getElementById("file");
const saveNameInput = document.getElementById("save_name");
const statusEl = document.getElementById("status");
const logListEl = document.getElementById("log-list");
const previewEmptyEl = document.getElementById("preview-empty");
const previewEl = document.getElementById("preview");
const previewNameEl = document.getElementById("preview-name");
const previewMetaEl = document.getElementById("preview-meta");
const summaryTriggerEl = document.getElementById("summary-trigger");
const summaryBoxEl = document.getElementById("summary-box");
const summaryFileEl = document.getElementById("summary-file");
const summaryGridEl = document.getElementById("summary-grid");
const summaryRawEl = document.getElementById("summary-raw");

let selectedLogId = null;

fileInput.addEventListener("change", () => {
  if (saveNameInput.value === "" && fileInput.files.length > 0) {
    saveNameInput.value = fileInput.files[0].name;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (fileInput.files.length === 0) {
    statusEl.textContent = "업로드할 파일을 선택하세요.";
    return;
  }

  statusEl.textContent = "업로드 중...";
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("save_name", saveNameInput.value);

  const response = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();
  if (response.ok === false) {
    statusEl.textContent = payload.detail || "업로드에 실패했습니다.";
    return;
  }

  statusEl.textContent = payload.filename + " 업로드 완료";
  form.reset();
  await loadLogs(payload.id);
});

summaryTriggerEl.addEventListener("click", async () => {
  if (selectedLogId === null) {
    return;
  }

  const shouldOpen = summaryBoxEl.classList.contains("open") === false;
  if (shouldOpen === false) {
    summaryBoxEl.classList.remove("open");
    summaryTriggerEl.textContent = "summary 보기";
    return;
  }

  summaryTriggerEl.disabled = true;
  summaryTriggerEl.textContent = "summary 불러오는 중...";
  const response = await fetch("/logs/" + selectedLogId + "/summary");
  const payload = await response.json();
  summaryTriggerEl.disabled = false;
  summaryTriggerEl.textContent = "summary 접기";

  if (response.ok === false) {
    summaryFileEl.textContent = payload.detail || "summary를 불러오지 못했습니다.";
    summaryGridEl.innerHTML = "";
    summaryRawEl.textContent = "";
    summaryBoxEl.classList.add("open");
    return;
  }

  summaryFileEl.textContent = payload.summary_filename;
  renderSummaryFields(payload.summary || {});
  summaryRawEl.textContent = payload.raw_text || "";
  summaryBoxEl.classList.add("open");
});

function renderSummaryFields(summary) {
  const entries = Object.entries(summary);
  if (entries.length === 0) {
    summaryGridEl.innerHTML = "<div class='summary-field'><strong>summary</strong><span>표시할 데이터가 없습니다.</span></div>";
    return;
  }

  summaryGridEl.innerHTML = entries.map(([key, value]) => {
    const safeValue = value === null || value === undefined || value === "" ? "-" : String(value);
    return "<div class='summary-field'><strong>" + escapeHtml(key) + "</strong><span>" + escapeHtml(safeValue) + "</span></div>";
  }).join("");
}

async function loadLogs(selectId) {
  const response = await fetch("/logs");
  const logs = await response.json();
  renderLogs(logs, selectId);
}

function renderLogs(logs, selectId) {
  if (logs.length === 0) {
    logListEl.innerHTML = "<div class='empty'>업로드된 파일이 없습니다.</div>";
    resetPreview();
    return;
  }

  logListEl.innerHTML = logs.map((log) => {
    const activeClass = log.id === selectId ? "active" : "";
    return "<button class='log-item " + activeClass + "' data-id='" + log.id + "' type='button'>" +
      "<strong>" + escapeHtml(log.filename) + "</strong>" +
      "<div class='meta'><span>ID " + log.id + "</span><span>" + formatBytes(log.size) + "</span></div>" +
    "</button>";
  }).join("");

  for (const item of logListEl.querySelectorAll(".log-item")) {
    item.addEventListener("click", () => {
      const id = Number(item.dataset.id);
      const log = logs.find((entry) => entry.id === id);
      if (log) {
        showPreview(log);
        renderLogs(logs, id);
      }
    });
  }

  const target = logs.find((log) => log.id === selectId) || logs[0];
  showPreview(target);
  if (target.id === selectId) {
    return;
  }
  renderLogs(logs, target.id);
}

function showPreview(log) {
  selectedLogId = log.id;
  previewEmptyEl.hidden = true;
  previewEl.hidden = false;
  previewNameEl.textContent = log.filename;
  previewMetaEl.textContent = "상태: " + log.status + " / 크기: " + formatBytes(log.size);
  summaryBoxEl.classList.remove("open");
  summaryTriggerEl.textContent = "summary 보기";
  summaryTriggerEl.disabled = false;
  summaryFileEl.textContent = "";
  summaryGridEl.innerHTML = "";
  summaryRawEl.textContent = "";
}

function resetPreview() {
  selectedLogId = null;
  previewEl.hidden = true;
  previewEmptyEl.hidden = false;
}

function formatBytes(bytes) {
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

loadLogs();
