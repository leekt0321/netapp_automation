const SESSION_KEY = "baobab-user";
const SESSION_NAME_KEY = "baobab-display-name";
const SESSION_DATE_KEY = "baobab-login-date";
const SESSION_SERVER_KEY = "baobab-server-session";
const STORAGE_KEYS = ["storage1", "storage2", "storage3"];

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

const uploadFormEl = document.getElementById("upload-form");
const fileInputEl = document.getElementById("file");
const storageNameEl = document.getElementById("storage-name");
const uploadFileListEl = document.getElementById("upload-file-list");
const statusEl = document.getElementById("status");
const totalLogCountEl = document.getElementById("total-log-count");
const latestLogNameEl = document.getElementById("latest-log-name");

const requestFormEl = document.getElementById("request-form");
const requestEditIdEl = document.getElementById("request-edit-id");
const requestStatusEl = document.getElementById("request-status");
const requestTitleEl = document.getElementById("request-title");
const requestContentEl = document.getElementById("request-content");
const requestStatusMessageEl = document.getElementById("request-status-message");
const requestListEl = document.getElementById("request-list");
const requestSubmitButtonEl = document.getElementById("request-submit-button");
const requestCancelButtonEl = document.getElementById("request-cancel-button");

const pageMeta = {
  dashboard: {
    title: "Dashboard",
    description: "업로드 파일 수와 최근 업로드 파일을 확인합니다.",
  },
  storage1: {
    title: "스토리지1",
    description: "스토리지1에 배치한 원본 로그와 요약 로그를 확인합니다.",
  },
  storage2: {
    title: "스토리지2",
    description: "스토리지2에 배치한 원본 로그와 요약 로그를 확인합니다.",
  },
  storage3: {
    title: "스토리지3",
    description: "스토리지3에 배치한 원본 로그와 요약 로그를 확인합니다.",
  },
  requests: {
    title: "수정 요청 게시판",
    description: "수정 요청을 등록하고 진행 상태를 관리합니다.",
  },
};

function getStorageElement(storageKey, role) {
  return document.querySelector('[data-storage="' + storageKey + '"][data-role="' + role + '"]');
}

const storageViews = {};
const storageState = {};
for (const storageKey of STORAGE_KEYS) {
  storageViews[storageKey] = {
    rawListEl: getStorageElement(storageKey, "raw-log-list"),
    rawEmptyEl: getStorageElement(storageKey, "raw-empty"),
    rawPreviewEl: getStorageElement(storageKey, "raw-preview"),
    rawNameEl: getStorageElement(storageKey, "raw-name"),
    rawMetaEl: getStorageElement(storageKey, "raw-meta"),
    rawContentEl: getStorageElement(storageKey, "raw-content"),
    summaryListEl: getStorageElement(storageKey, "summary-log-list"),
    summaryEmptyEl: getStorageElement(storageKey, "summary-empty"),
    summaryPreviewEl: getStorageElement(storageKey, "summary-preview"),
    summaryNameEl: getStorageElement(storageKey, "summary-name"),
    summaryMetaEl: getStorageElement(storageKey, "summary-meta"),
    summaryGridEl: getStorageElement(storageKey, "summary-grid"),
    summaryRawEl: getStorageElement(storageKey, "summary-raw"),
  };
  storageState[storageKey] = {
    rawId: null,
    summaryId: null,
  };
}

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
  localStorage.setItem(SESSION_DATE_KEY, getTodayKey());
  localStorage.setItem(SESSION_SERVER_KEY, payload.server_session_id || "");
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

fileInputEl.addEventListener("change", () => {
  renderSelectedFiles();
});

uploadFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedFiles = Array.from(fileInputEl.files || []);
  const storageName = typeof storageNameEl.value === "string" ? storageNameEl.value.trim() : "";

  if (storageName === "") {
    statusEl.textContent = "표시할 스토리지를 선택하세요.";
    return;
  }
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

  const saveNames = saveNameInputs.map((input) => {
    return typeof input.value === "string" ? input.value.trim() : "";
  });
  if (saveNames.some((value) => value === "")) {
    statusEl.textContent = "각 파일의 저장 이름을 모두 입력하세요.";
    return;
  }

  statusEl.textContent = selectedFiles.length > 1 ? "여러 파일 업로드 중..." : "업로드 중...";
  const formData = new FormData();
  formData.append("storage_name", storageName);
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

    statusEl.textContent = payload.count + "개 파일 업로드 완료";
    uploadFormEl.reset();
    renderSelectedFiles();
    await loadLogs();
    showPage(storageName);
  } catch (error) {
    console.error("upload failed", error);
    statusEl.textContent = "서버에 연결하지 못했습니다. 서버 재시작 후 새로고침해서 다시 시도해 주세요.";
  }
});

requestFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = requestTitleEl.value.trim();
  const content = requestContentEl.value.trim();
  const status = requestStatusEl.value.trim();
  const editId = requestEditIdEl.value.trim();
  const author = localStorage.getItem(SESSION_NAME_KEY) || localStorage.getItem(SESSION_KEY);

  if (title === "" || content === "") {
    requestStatusMessageEl.textContent = "제목과 내용을 모두 입력하세요.";
    return;
  }

  const isEdit = editId !== "";
  requestStatusMessageEl.textContent = isEdit ? "수정 요청 저장 중..." : "수정 요청 등록 중...";

  const response = await fetch(isEdit ? "/requests/" + editId : "/requests", {
    method: isEdit ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, status, author }),
  });
  const payload = await response.json();

  if (response.ok === false) {
    requestStatusMessageEl.textContent = payload.detail || "수정 요청 저장에 실패했습니다.";
    return;
  }

  resetRequestForm();
  requestStatusMessageEl.textContent = isEdit ? "수정 요청이 업데이트되었습니다." : "수정 요청이 등록되었습니다.";
  await loadRequestPosts();
});

requestCancelButtonEl.addEventListener("click", () => {
  resetRequestForm();
  requestStatusMessageEl.textContent = "수정 모드를 취소했습니다.";
});

document.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton === null) {
    return;
  }

  const action = actionButton.dataset.action;
  const storageKey = actionButton.dataset.storage;

  if (action === "download-raw" || action === "download-summary") {
    const logId = action === "download-raw" ? storageState[storageKey].rawId : storageState[storageKey].summaryId;
    if (logId !== null) {
      window.location.href = "/logs/" + logId + "/download";
    }
    return;
  }

  if (action === "delete-raw" || action === "delete-summary") {
    const logId = action === "delete-raw" ? storageState[storageKey].rawId : storageState[storageKey].summaryId;
    await deleteSelectedLog(logId, storageKey);
    return;
  }

  if (action === "request-edit") {
    populateRequestForm(Number(actionButton.dataset.id));
    return;
  }

  if (action === "request-delete") {
    await deleteRequestPost(Number(actionButton.dataset.id));
  }
});

function renderSelectedFiles() {
  const selectedFiles = Array.from(fileInputEl.files || []);
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
  localStorage.removeItem(SESSION_DATE_KEY);
  localStorage.removeItem(SESSION_SERVER_KEY);
  appShellEl.hidden = true;
  loginScreenEl.hidden = false;
}

function openApp(displayName) {
  loginUserEl.textContent = displayName + " 님";
  loginScreenEl.hidden = true;
  appShellEl.hidden = false;
  deleteStatusEl.textContent = "";
  showPage("dashboard");
  loadInitialData();
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

async function loadInitialData() {
  await Promise.all([loadLogs(), loadRequestPosts()]);
}

async function loadLogs() {
  const response = await fetch("/logs");
  const logs = await response.json();
  const allLogs = Array.isArray(logs) ? logs : [];
  updateDashboard(allLogs);
  for (const storageKey of STORAGE_KEYS) {
    renderStoragePage(storageKey, allLogs.filter((log) => log.storage_name === storageKey));
  }
}

function updateDashboard(logs) {
  totalLogCountEl.textContent = String(logs.length);
  latestLogNameEl.textContent = logs.length > 0 ? logs[0].filename + " / " + toStorageLabel(logs[0].storage_name) : "-";
}

function renderStoragePage(storageKey, logs) {
  const view = storageViews[storageKey];
  const state = storageState[storageKey];

  if (view.rawListEl === null || view.summaryListEl === null) {
    return;
  }

  if (logs.length === 0) {
    state.rawId = null;
    state.summaryId = null;
    view.rawListEl.innerHTML = "<div class='empty'>표시할 로그가 없습니다.</div>";
    view.summaryListEl.innerHTML = "<div class='empty'>표시할 summary가 없습니다.</div>";
    view.rawEmptyEl.hidden = false;
    view.rawEmptyEl.textContent = "업로드된 원본 로그가 없습니다.";
    view.rawPreviewEl.hidden = true;
    view.summaryEmptyEl.hidden = false;
    view.summaryEmptyEl.textContent = "업로드된 summary가 없습니다.";
    view.summaryPreviewEl.hidden = true;
    return;
  }

  const availableIds = logs.map((log) => log.id);
  if (availableIds.includes(state.rawId) === false) {
    state.rawId = logs[0].id;
  }
  if (availableIds.includes(state.summaryId) === false) {
    state.summaryId = logs[0].id;
  }

  renderLogList(view.rawListEl, logs, state.rawId, (logId) => {
    state.rawId = logId;
    renderStoragePage(storageKey, logs);
    loadRawLog(storageKey, logId);
  });
  renderLogList(view.summaryListEl, logs, state.summaryId, (logId) => {
    state.summaryId = logId;
    renderStoragePage(storageKey, logs);
    loadSummary(storageKey, logId);
  });

  loadRawLog(storageKey, state.rawId);
  loadSummary(storageKey, state.summaryId);
}

function renderLogList(container, logs, activeId, onClick) {
  container.innerHTML = logs.map((log) => renderListButton(log, activeId)).join("");
  for (const item of container.querySelectorAll(".log-item")) {
    item.addEventListener("click", () => {
      onClick(Number(item.dataset.id));
    });
  }
}

function renderListButton(log, activeId) {
  const activeClass = log.id === activeId ? "active" : "";
  return "<button class='log-item " + activeClass + "' data-id='" + log.id + "' type='button'>" +
    "<strong>" + escapeHtml(log.filename) + "</strong>" +
    "<div class='meta'><span>" + escapeHtml(toStorageLabel(log.storage_name)) + "</span><span>" + formatBytes(log.size) + "</span></div>" +
  "</button>";
}

async function loadRawLog(storageKey, logId) {
  const view = storageViews[storageKey];
  const response = await fetch("/logs/" + logId + "/raw");
  const payload = await response.json();

  if (response.ok === false) {
    view.rawPreviewEl.hidden = true;
    view.rawEmptyEl.hidden = false;
    view.rawEmptyEl.textContent = payload.detail || "원본 로그를 불러오지 못했습니다.";
    return;
  }

  view.rawEmptyEl.hidden = true;
  view.rawPreviewEl.hidden = false;
  view.rawNameEl.textContent = payload.filename;
  view.rawMetaEl.textContent = "상태: " + payload.status + " / 저장 위치: " + toStorageLabel(payload.storage_name) + " / 크기: " + formatBytes(payload.size);
  view.rawContentEl.textContent = payload.raw_text || "";
}

async function loadSummary(storageKey, logId) {
  const view = storageViews[storageKey];
  const response = await fetch("/logs/" + logId + "/summary");
  const payload = await response.json();

  if (response.ok === false) {
    view.summaryPreviewEl.hidden = true;
    view.summaryEmptyEl.hidden = false;
    view.summaryEmptyEl.textContent = payload.detail || "summary를 불러오지 못했습니다.";
    return;
  }

  view.summaryEmptyEl.hidden = true;
  view.summaryPreviewEl.hidden = false;
  view.summaryNameEl.textContent = payload.summary_filename;
  view.summaryMetaEl.textContent = payload.filename + " / " + toStorageLabel(payload.storage_name);
  renderSummaryFields(view.summaryGridEl, payload.summary || {});
  view.summaryRawEl.textContent = payload.raw_text || "";
}

function renderSummaryFields(container, summary) {
  const entries = Object.entries(summary);
  if (entries.length === 0) {
    container.innerHTML = "<div class='summary-field'><strong>summary</strong><span>표시할 데이터가 없습니다.</span></div>";
    return;
  }

  container.innerHTML = entries.map(([key, value]) => {
    const safeValue = value === null || value === undefined || value === "" ? "-" : String(value);
    return "<div class='summary-field'><strong>" + escapeHtml(key) + "</strong><span>" + escapeHtml(safeValue) + "</span></div>";
  }).join("");
}

async function deleteSelectedLog(logId, storageKey) {
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
    statusEl.textContent = payload.detail || "파일 삭제에 실패했습니다.";
    return;
  }

  storageState[storageKey].rawId = null;
  storageState[storageKey].summaryId = null;
  statusEl.textContent = payload.filename + " 삭제 완료";
  await loadLogs();
  showPage(storageKey);
}

async function loadRequestPosts() {
  const response = await fetch("/requests");
  const payload = await response.json();
  renderRequestPosts(Array.isArray(payload) ? payload : []);
}

function renderRequestPosts(posts) {
  if (posts.length === 0) {
    requestListEl.innerHTML = "<div class='empty'>등록된 수정 요청이 없습니다.</div>";
    return;
  }

  requestListEl.innerHTML = posts.map((post) => {
    return "<article class='request-card'>" +
      "<div class='request-top'>" +
        "<div class='request-header'><span class='badge " + getStatusBadgeClass(post.status) + "'>" + escapeHtml(post.status) + "</span></div>" +
        "<div class='request-actions'>" +
          "<button class='secondary' data-action='request-edit' data-id='" + post.id + "' type='button'>수정</button>" +
          "<button class='danger' data-action='request-delete' data-id='" + post.id + "' type='button'>삭제</button>" +
        "</div>" +
      "</div>" +
      "<h3 class='request-title'>" + escapeHtml(post.title) + "</h3>" +
      "<p class='request-content'>" + escapeHtml(post.content) + "</p>" +
      "<div class='request-meta'><span>작성자: " + escapeHtml(post.author || "-") + "</span><span>업데이트: " + escapeHtml(formatDate(post.updated_at || post.created_at)) + "</span></div>" +
    "</article>";
  }).join("");
}

function populateRequestForm(postId) {
  fetch("/requests")
    .then((response) => response.json())
    .then((posts) => {
      const target = Array.isArray(posts) ? posts.find((post) => post.id === postId) : null;
      if (target === undefined || target === null) {
        return;
      }
      requestEditIdEl.value = String(target.id);
      requestStatusEl.value = target.status;
      requestTitleEl.value = target.title;
      requestContentEl.value = target.content;
      requestSubmitButtonEl.textContent = "수정 저장";
      requestCancelButtonEl.hidden = false;
      requestStatusMessageEl.textContent = "수정할 내용을 편집한 뒤 저장하세요.";
      showPage("requests");
    });
}

async function deleteRequestPost(postId) {
  const confirmed = window.confirm("이 수정 요청 글을 삭제하시겠습니까?");
  if (confirmed === false) {
    return;
  }

  const response = await fetch("/requests/" + postId, {
    method: "DELETE",
  });
  const payload = await response.json();

  if (response.ok === false) {
    requestStatusMessageEl.textContent = payload.detail || "수정 요청 삭제에 실패했습니다.";
    return;
  }

  if (requestEditIdEl.value === String(postId)) {
    resetRequestForm();
  }
  requestStatusMessageEl.textContent = payload.title + " 글이 삭제되었습니다.";
  await loadRequestPosts();
}

function resetRequestForm() {
  requestFormEl.reset();
  requestEditIdEl.value = "";
  requestSubmitButtonEl.textContent = "등록";
  requestCancelButtonEl.hidden = true;
}

function getStatusBadgeClass(status) {
  if (status === "완료") {
    return "done";
  }
  if (status === "진행중") {
    return "doing";
  }
  return "wait";
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

function formatDate(value) {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toStorageLabel(storageKey) {
  if (storageKey === "storage1") {
    return "스토리지1";
  }
  if (storageKey === "storage2") {
    return "스토리지2";
  }
  if (storageKey === "storage3") {
    return "스토리지3";
  }
  return storageKey || "-";
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function restoreSession() {
  const savedUser = localStorage.getItem(SESSION_KEY);
  const savedDisplayName = localStorage.getItem(SESSION_NAME_KEY);
  const savedLoginDate = localStorage.getItem(SESSION_DATE_KEY);
  const savedServerSession = localStorage.getItem(SESSION_SERVER_KEY);

  if (savedUser === null || savedDisplayName === null || savedLoginDate === null || savedServerSession === null) {
    clearSession();
    return;
  }

  if (savedLoginDate !== getTodayKey()) {
    clearSession();
    loginStatusEl.textContent = "세션이 만료되었습니다. 다시 로그인해 주세요.";
    return;
  }

  try {
    const response = await fetch("/api", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok === false || payload.server_session_id !== savedServerSession) {
      clearSession();
      loginStatusEl.textContent = "서버가 다시 시작되어 세션이 만료되었습니다. 다시 로그인해 주세요.";
      return;
    }

    openApp(savedDisplayName);
  } catch (error) {
    clearSession();
    loginStatusEl.textContent = "서버에 연결할 수 없어 다시 로그인해 주세요.";
  }
}

restoreSession();
