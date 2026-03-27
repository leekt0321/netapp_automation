const SESSION_KEY = "baobab-user";
const SESSION_NAME_KEY = "baobab-display-name";

const loginScreenEl = document.getElementById("login-screen");
const appShellEl = document.getElementById("app-shell");
const loginFormEl = document.getElementById("login-form");
const loginIdEl = document.getElementById("login-id");
const loginPasswordEl = document.getElementById("login-password");
const loginStatusEl = document.getElementById("login-status");
const registerFormEl = document.getElementById("register-form");
const registerNameEl = document.getElementById("register-name");
const registerIdEl = document.getElementById("register-id");
const registerPasswordEl = document.getElementById("register-password");
const registerStatusEl = document.getElementById("register-status");
const loginUserEl = document.getElementById("login-user");
const logoutButtonEl = document.getElementById("logout-button");
const deleteFormEl = document.getElementById("delete-form");
const deletePasswordEl = document.getElementById("delete-password");
const deleteStatusEl = document.getElementById("delete-status");

const navButtons = Array.from(document.querySelectorAll(".nav-button"));
const pageSections = Array.from(document.querySelectorAll(".page-section"));
const pageTitleEl = document.getElementById("page-title");
const pageDescriptionEl = document.getElementById("page-description");
const pageLinkButtons = Array.from(document.querySelectorAll(".page-link"));
const logsBackButtonEl = document.getElementById("logs-back-button");
const summaryBackButtonEl = document.getElementById("summary-back-button");

const form = document.getElementById("upload-form");
const fileInput = document.getElementById("file");
const uploadFileListEl = document.getElementById("upload-file-list");
const statusEl = document.getElementById("status");
const totalLogCountEl = document.getElementById("total-log-count");
const latestLogNameEl = document.getElementById("latest-log-name");

const rawLogListEl = document.getElementById("raw-log-list");
const rawEmptyEl = document.getElementById("raw-empty");
const rawPreviewEl = document.getElementById("raw-preview");
const rawNameEl = document.getElementById("raw-name");
const rawMetaEl = document.getElementById("raw-meta");
const rawContentEl = document.getElementById("raw-content");

const summaryLogListEl = document.getElementById("summary-log-list");
const summaryEmptyEl = document.getElementById("summary-empty");
const summaryPreviewEl = document.getElementById("summary-preview");
const summaryNameEl = document.getElementById("summary-name");
const summaryMetaEl = document.getElementById("summary-meta");
const summaryGridEl = document.getElementById("summary-grid");
const summaryRawEl = document.getElementById("summary-raw");
const rawDownloadButtonEl = document.getElementById("raw-download-button");
const rawDeleteButtonEl = document.getElementById("raw-delete-button");
const summaryDownloadButtonEl = document.getElementById("summary-download-button");
const summaryDeleteButtonEl = document.getElementById("summary-delete-button");

const pageMeta = {
  dashboard: {
    title: "Dashboard",
    description: "업로드와 최근 현황을 확인합니다.",
  },
  logs: {
    title: "Original Logs",
    description: "원본 로그 파일 내용을 직접 검토합니다.",
  },
  summary: {
    title: "Summary Info",
    description: "summary 정보를 확인합니다.",
  },
};

let selectedRawLogId = null;
let selectedSummaryLogId = null;

loginFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = loginIdEl.value.trim();
  const password = loginPasswordEl.value.trim();

  if (username === "" || password === "") {
    loginStatusEl.textContent = "아이디와 비밀번호를 입력하세요.";
    return;
  }

  loginStatusEl.textContent = "로그인 확인 중...";
  const response = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json();

  if (response.ok === false) {
    loginStatusEl.textContent = payload.detail || "로그인에 실패했습니다.";
    return;
  }

  localStorage.setItem(SESSION_KEY, payload.username);
  localStorage.setItem(SESSION_NAME_KEY, payload.full_name || payload.username);
  loginStatusEl.textContent = "";
  loginFormEl.reset();
  openApp(payload.full_name || payload.username);
});

registerFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = registerIdEl.value.trim();
  const password = registerPasswordEl.value.trim();
  const fullName = registerNameEl.value.trim();

  if (username === "" || password === "") {
    registerStatusEl.textContent = "아이디와 비밀번호를 입력하세요.";
    return;
  }

  registerStatusEl.textContent = "회원가입 처리 중...";
  const response = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, full_name: fullName || null }),
  });
  const payload = await response.json();

  if (response.ok === false) {
    registerStatusEl.textContent = payload.detail || "회원가입에 실패했습니다.";
    return;
  }

  registerStatusEl.textContent = payload.username + " 계정이 생성되었습니다. 로그인하세요.";
  registerFormEl.reset();
});

logoutButtonEl.addEventListener("click", () => {
  clearSession();
  loginStatusEl.textContent = "로그아웃되었습니다.";
});

deleteFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = localStorage.getItem(SESSION_KEY);
  const password = deletePasswordEl.value.trim();

  if (username === null || password === "") {
    deleteStatusEl.textContent = "비밀번호를 입력하세요.";
    return;
  }

  deleteStatusEl.textContent = "회원탈퇴 처리 중...";
  const response = await fetch("/auth/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json();

  if (response.ok === false) {
    deleteStatusEl.textContent = payload.detail || "회원탈퇴에 실패했습니다.";
    return;
  }

  deleteFormEl.reset();
  deleteStatusEl.textContent = "회원탈퇴가 완료되었습니다.";
  clearSession();
  loginStatusEl.textContent = payload.username + " 계정이 삭제되었습니다.";
});

for (const button of navButtons) {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
}

for (const button of pageLinkButtons) {
  button.addEventListener("click", () => {
    showPage(button.dataset.targetPage);
  });
}

logsBackButtonEl.addEventListener("click", () => {
  showPage("dashboard");
});

summaryBackButtonEl.addEventListener("click", () => {
  showPage("dashboard");
});

rawDownloadButtonEl.addEventListener("click", () => {
  if (selectedRawLogId !== null) {
    window.location.href = "/logs/" + selectedRawLogId + "/download";
  }
});

summaryDownloadButtonEl.addEventListener("click", () => {
  if (selectedSummaryLogId !== null) {
    window.location.href = "/logs/" + selectedSummaryLogId + "/download";
  }
});

rawDeleteButtonEl.addEventListener("click", async () => {
  await deleteSelectedLog(selectedRawLogId, "logs");
});

summaryDeleteButtonEl.addEventListener("click", async () => {
  await deleteSelectedLog(selectedSummaryLogId, "summary");
});

fileInput.addEventListener("change", () => {
  renderSelectedFiles();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedFiles = Array.from(fileInput.files || []);
  if (selectedFiles.length === 0) {
    statusEl.textContent = "업로드할 파일을 선택하세요.";
    return;
  }

  if (uploadFileListEl === null) {
    statusEl.textContent = "업로드 화면을 새로고침한 뒤 다시 시도해 주세요.";
    return;
  }

  const saveNameInputs = Array.from(document.querySelectorAll(".save-name-input"));
  if (saveNameInputs.length !== selectedFiles.length) {
    statusEl.textContent = "선택한 파일 목록을 다시 확인해 주세요.";
    return;
  }

  const saveNames = saveNameInputs.map((input) => (typeof input.value === "string" ? input.value.trim() : ""));
  if (saveNames.some((value) => value === "")) {
    statusEl.textContent = "각 파일의 저장 이름을 모두 입력하세요.";
    return;
  }

  statusEl.textContent = selectedFiles.length > 1 ? "여러 파일 업로드 중..." : "업로드 중...";
  const formData = new FormData();
  for (const file of selectedFiles) {
    formData.append("files", file);
  }
  for (const saveName of saveNames) {
    formData.append("save_names", saveName);
  }

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();
    if (response.ok === false) {
      statusEl.textContent = payload.detail || "업로드에 실패했습니다.";
      return;
    }

    const latestItem = payload.latest || payload.items[payload.items.length - 1];
    statusEl.textContent = payload.count + "개 파일 업로드 완료";
    form.reset();
    renderSelectedFiles();
    await loadLogs(latestItem.id, latestItem.id);
    showPage("summary");
  } catch (error) {
    console.error("upload failed", error);
    statusEl.textContent = "서버에 연결하지 못했습니다. 서버 재시작 후 새로고침해서 다시 시도해 주세요.";
  }
});

function renderSelectedFiles() {
  const selectedFiles = Array.from(fileInput.files || []);

  if (uploadFileListEl === null) {
    return;
  }

  if (selectedFiles.length === 0) {
    uploadFileListEl.innerHTML = "<div class='empty'>파일을 선택하면 각 파일의 저장 이름 입력칸이 여기에 표시됩니다.</div>";
    return;
  }

  uploadFileListEl.innerHTML = selectedFiles.map((file, index) => {
    return "<label class='file-name-row'>" +
      "<span class='file-name-title'>" + escapeHtml(file.name) + "</span>" +
      "<input class='save-name-input' type='text' name='save_names' value='" + escapeHtml(file.name) + "' data-index='" + index + "' required>" +
    "</label>";
  }).join("");
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_NAME_KEY);
  appShellEl.hidden = true;
  loginScreenEl.hidden = false;
}

function openApp(displayName) {
  loginUserEl.textContent = displayName + " 님";
  loginScreenEl.hidden = true;
  appShellEl.hidden = false;
  deleteStatusEl.textContent = "";
  showPage("dashboard");
  loadLogs();
}

function showPage(page) {
  for (const button of navButtons) {
    button.classList.toggle("active", button.dataset.page === page);
  }

  for (const section of pageSections) {
    section.classList.toggle("active", section.id === "page-" + page);
  }

  pageTitleEl.textContent = pageMeta[page].title;
  pageDescriptionEl.textContent = pageMeta[page].description;
}

async function loadLogs(rawSelectId, summarySelectId) {
  const response = await fetch("/logs");
  const logs = await response.json();

  updateDashboard(logs);
  renderRawLogs(logs, rawSelectId);
  renderSummaryLogs(logs, summarySelectId);
}

function updateDashboard(logs) {
  totalLogCountEl.textContent = String(logs.length);
  latestLogNameEl.textContent = logs.length > 0 ? logs[0].filename : "-";
}

function renderRawLogs(logs, selectId) {
  if (logs.length === 0) {
    rawLogListEl.innerHTML = "<div class='empty'>업로드된 원본 로그가 없습니다.</div>";
    rawPreviewEl.hidden = true;
    rawEmptyEl.hidden = false;
    selectedRawLogId = null;
    return;
  }

  selectedRawLogId = selectId || selectedRawLogId || logs[0].id;
  rawLogListEl.innerHTML = logs.map((log) => renderListButton(log, selectedRawLogId)).join("");

  for (const item of rawLogListEl.querySelectorAll(".log-item")) {
    item.addEventListener("click", () => {
      selectedRawLogId = Number(item.dataset.id);
      renderRawLogs(logs, selectedRawLogId);
      loadRawLog(selectedRawLogId);
    });
  }

  loadRawLog(selectedRawLogId);
}

function renderSummaryLogs(logs, selectId) {
  if (logs.length === 0) {
    summaryLogListEl.innerHTML = "<div class='empty'>업로드된 summary가 없습니다.</div>";
    summaryPreviewEl.hidden = true;
    summaryEmptyEl.hidden = false;
    selectedSummaryLogId = null;
    return;
  }

  selectedSummaryLogId = selectId || selectedSummaryLogId || logs[0].id;
  summaryLogListEl.innerHTML = logs.map((log) => renderListButton(log, selectedSummaryLogId)).join("");

  for (const item of summaryLogListEl.querySelectorAll(".log-item")) {
    item.addEventListener("click", () => {
      selectedSummaryLogId = Number(item.dataset.id);
      renderSummaryLogs(logs, selectedSummaryLogId);
      loadSummary(selectedSummaryLogId);
    });
  }

  loadSummary(selectedSummaryLogId);
}

function renderListButton(log, activeId) {
  const activeClass = log.id === activeId ? "active" : "";
  return "<button class='log-item " + activeClass + "' data-id='" + log.id + "' type='button'>" +
    "<strong>" + escapeHtml(log.filename) + "</strong>" +
    "<div class='meta'><span>ID " + log.id + "</span><span>" + formatBytes(log.size) + "</span></div>" +
  "</button>";
}

async function loadRawLog(logId) {
  const response = await fetch("/logs/" + logId + "/raw");
  const payload = await response.json();

  if (response.ok === false) {
    rawPreviewEl.hidden = true;
    rawEmptyEl.hidden = false;
    rawEmptyEl.textContent = payload.detail || "원본 로그를 불러오지 못했습니다.";
    return;
  }

  rawEmptyEl.hidden = true;
  rawPreviewEl.hidden = false;
  rawNameEl.textContent = payload.filename;
  rawMetaEl.textContent = "상태: " + payload.status + " / 크기: " + formatBytes(payload.size);
  rawContentEl.textContent = payload.raw_text || "";
}

async function loadSummary(logId) {
  const response = await fetch("/logs/" + logId + "/summary");
  const payload = await response.json();

  if (response.ok === false) {
    summaryPreviewEl.hidden = true;
    summaryEmptyEl.hidden = false;
    summaryEmptyEl.textContent = payload.detail || "summary를 불러오지 못했습니다.";
    return;
  }

  summaryEmptyEl.hidden = true;
  summaryPreviewEl.hidden = false;
  summaryNameEl.textContent = payload.summary_filename;
  summaryMetaEl.textContent = payload.filename + " 에서 생성된 summary";
  renderSummaryFields(payload.summary || {});
  summaryRawEl.textContent = payload.raw_text || "";
}

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

async function deleteSelectedLog(logId, page) {
  if (logId === null) {
    return;
  }

  const confirmed = window.confirm("선택한 업로드 파일을 삭제하시겠습니까?");
  if (confirmed === false) {
    return;
  }

  const response = await fetch("/logs/" + logId, {
    method: "DELETE",
  });
  const payload = await response.json();

  if (response.ok === false) {
    const message = payload.detail || "파일 삭제에 실패했습니다.";
    statusEl.textContent = message;
    deleteStatusEl.textContent = message;
    return;
  }

  selectedRawLogId = null;
  selectedSummaryLogId = null;
  statusEl.textContent = payload.filename + " 삭제 완료";
  await loadLogs();
  showPage(page);
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const savedUser = localStorage.getItem(SESSION_KEY);
const savedDisplayName = localStorage.getItem(SESSION_NAME_KEY);
if (savedUser !== null && savedDisplayName !== null) {
  openApp(savedDisplayName);
}
