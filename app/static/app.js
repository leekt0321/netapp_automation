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
const siteIdEl = document.getElementById("site-id");
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
const requestSearchEl = document.getElementById("request-search");
const requestFilterButtons = Array.from(document.querySelectorAll("[data-request-filter]"));

const pageMeta = {
  dashboard: {
    title: "Dashboard",
    description: "업로드 파일 수와 최근 업로드 파일을 확인합니다.",
  },
  storage1: {
    title: "스토리지1",
    description: "스토리지1 내부 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  storage2: {
    title: "스토리지2",
    description: "스토리지2 내부 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  storage3: {
    title: "스토리지3",
    description: "스토리지3 내부 사이트별 원본 로그와 요약 로그를 확인합니다.",
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
    siteFormEl: getStorageElement(storageKey, "site-form"),
    siteEditIdEl: getStorageElement(storageKey, "site-edit-id"),
    siteNameInputEl: getStorageElement(storageKey, "site-name-input"),
    siteStatusEl: getStorageElement(storageKey, "site-status"),
    siteListEl: getStorageElement(storageKey, "site-list"),
    siteCurrentEl: getStorageElement(storageKey, "site-current"),
    logsViewEl: getStorageElement(storageKey, "storage-logs-view"),
    sitesViewEl: getStorageElement(storageKey, "storage-sites-view"),
    rawSectionEl: getStorageElement(storageKey, "storage-raw-view"),
    summarySectionEl: getStorageElement(storageKey, "storage-summary-view"),
  };
  storageState[storageKey] = {
    rawId: null,
    summaryId: null,
    activeSiteId: null,
    activeView: "sites",
    activeLogView: "raw",
  };
}

let allLogs = [];
let allSites = [];
let allRequestPosts = [];
let activeRequestFilter = "all";

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

for (const storageKey of STORAGE_KEYS) {
  const view = storageViews[storageKey];
  if (view.siteFormEl !== null) {
    view.siteFormEl.addEventListener("submit", (event) => {
      event.preventDefault();
      saveStorageSite(storageKey);
    });
  }
}

fileInputEl.addEventListener("change", () => {
  renderSelectedFiles();
});

if (requestSearchEl !== null) {
  requestSearchEl.addEventListener("input", () => {
    renderFilteredRequestPosts();
  });
}

for (const button of requestFilterButtons) {
  button.addEventListener("click", () => {
    activeRequestFilter = button.dataset.requestFilter || "all";
    updateRequestFilterButtons();
    renderFilteredRequestPosts();
  });
}

storageNameEl.addEventListener("change", () => {
  syncUploadSiteOptions();
});

uploadFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedFiles = Array.from(fileInputEl.files || []);
  const storageName = typeof storageNameEl.value === "string" ? storageNameEl.value.trim() : "";
  const siteId = typeof siteIdEl.value === "string" ? siteIdEl.value.trim() : "";

  if (storageName === "") {
    statusEl.textContent = "표시할 스토리지를 선택하세요.";
    return;
  }
  if (siteId === "") {
    statusEl.textContent = "업로드할 사이트를 선택하세요.";
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
  formData.append("site_id", siteId);
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
    storageNameEl.value = payload.storage_name;
    syncUploadSiteOptions(payload.site_id);
    storageState[payload.storage_name].activeSiteId = payload.site_id;
    storageState[payload.storage_name].activeView = "logs";
    await loadLogs();
    showPage(payload.storage_name);
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

  if (action === "open-site-logs") {
    storageState[storageKey].activeSiteId = Number(actionButton.dataset.id);
    storageState[storageKey].activeView = "logs";
    renderSiteSections();
    renderAllStoragePages();
    return;
  }

  if (action === "storage-back") {
    storageState[storageKey].activeView = "sites";
    renderStorageSubViews(storageKey);
    return;
  }

  if (action === "storage-log-view") {
    storageState[storageKey].activeLogView = actionButton.dataset.logView === "summary" ? "summary" : "raw";
    renderStorageLogView(storageKey);
    return;
  }

  if (action === "site-edit") {
    populateSiteForm(storageKey, Number(actionButton.dataset.id));
    return;
  }

  if (action === "site-delete") {
    await deleteStorageSite(storageKey, Number(actionButton.dataset.id));
    return;
  }

  if (action === "site-cancel-edit") {
    resetSiteForm(storageKey);
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
  await loadSites();
  await Promise.all([loadLogs(), loadRequestPosts()]);
}

async function loadSites() {
  const response = await fetch("/sites");
  const payload = await response.json();
  allSites = Array.isArray(payload) ? payload : [];
  renderSiteSections();
  syncUploadSiteOptions();
}

async function loadLogs() {
  const response = await fetch("/logs");
  const logs = await response.json();
  allLogs = Array.isArray(logs) ? logs : [];
  updateDashboard(allLogs);
  renderAllStoragePages();
}

function renderAllStoragePages() {
  for (const storageKey of STORAGE_KEYS) {
    renderStorageSubViews(storageKey);
    renderStorageLogView(storageKey);
    renderStoragePage(storageKey);
  }
}

function renderStorageSubViews(storageKey) {
  const view = storageViews[storageKey];
  const activeView = storageState[storageKey].activeView;
  if (view.logsViewEl !== null) {
    view.logsViewEl.hidden = activeView !== "logs";
  }
  if (view.sitesViewEl !== null) {
    view.sitesViewEl.hidden = activeView !== "sites";
  }
}

function renderStorageLogView(storageKey) {
  const view = storageViews[storageKey];
  const activeLogView = storageState[storageKey].activeLogView;

  if (view.rawSectionEl !== null) {
    view.rawSectionEl.hidden = activeLogView !== "raw";
  }
  if (view.summarySectionEl !== null) {
    view.summarySectionEl.hidden = activeLogView !== "summary";
  }

  const buttons = document.querySelectorAll('[data-action="storage-log-view"][data-storage="' + storageKey + '"]');
  for (const button of buttons) {
    button.classList.toggle("active", button.dataset.logView === activeLogView);
  }
}

function updateDashboard(logs) {
  totalLogCountEl.textContent = String(logs.length);
  if (logs.length === 0) {
    latestLogNameEl.textContent = "-";
    return;
  }

  const latest = logs[0];
  const siteLabel = latest.site_name ? " > " + latest.site_name : "";
  latestLogNameEl.textContent = latest.filename + " / " + toStorageLabel(latest.storage_name) + siteLabel;
}

function renderSiteSections() {
  for (const storageKey of STORAGE_KEYS) {
    const view = storageViews[storageKey];
    const sites = getSitesByStorage(storageKey);
    const state = storageState[storageKey];

    if (sites.some((site) => site.id === state.activeSiteId) === false) {
      state.activeSiteId = sites.length > 0 ? sites[0].id : null;
    }

    renderSiteList(storageKey, sites);
    renderSiteCurrent(storageKey, sites);
  }
}

function renderSiteList(storageKey, sites) {
  const view = storageViews[storageKey];
  if (view.siteListEl === null) {
    return;
  }

  if (sites.length === 0) {
    view.siteListEl.innerHTML = "<div class='empty'>등록된 사이트가 없습니다.</div>";
    return;
  }

  view.siteListEl.innerHTML = sites.map((site) => {
    const activeClass = storageState[storageKey].activeSiteId === site.id ? " active" : "";
    return "<article class='site-item" + activeClass + "'>" +
      "<div><strong>" + escapeHtml(site.name) + "</strong><p>" + escapeHtml(toStorageLabel(site.storage_name)) + "</p></div>" +
      "<div class='request-actions'>" +
        "<button data-action='open-site-logs' data-storage='" + storageKey + "' data-id='" + site.id + "' type='button'>로그 보기</button>" +
        "<button class='secondary' data-action='site-edit' data-storage='" + storageKey + "' data-id='" + site.id + "' type='button'>수정</button>" +
        "<button class='danger' data-action='site-delete' data-storage='" + storageKey + "' data-id='" + site.id + "' type='button'>삭제</button>" +
      "</div>" +
    "</article>";
  }).join("");
}

function renderSiteCurrent(storageKey, sites) {
  const view = storageViews[storageKey];
  if (view.siteCurrentEl === null) {
    return;
  }

  if (sites.length === 0 || storageState[storageKey].activeSiteId === null) {
    view.siteCurrentEl.textContent = "먼저 사이트를 등록하면 이 페이지에서 해당 사이트 로그를 확인할 수 있습니다.";
    return;
  }

  const site = sites.find((item) => item.id === storageState[storageKey].activeSiteId);
  view.siteCurrentEl.textContent = site ? toStorageLabel(storageKey) + " > " + site.name : "";
}

function renderStoragePage(storageKey) {
  const view = storageViews[storageKey];
  const state = storageState[storageKey];
  const sites = getSitesByStorage(storageKey);

  if (view.rawListEl === null || view.summaryListEl === null) {
    return;
  }

  if (sites.length === 0 || state.activeSiteId === null) {
    state.rawId = null;
    state.summaryId = null;
    view.rawListEl.innerHTML = "<div class='empty'>먼저 사이트를 등록하세요.</div>";
    view.summaryListEl.innerHTML = "<div class='empty'>먼저 사이트를 등록하세요.</div>";
    view.rawEmptyEl.hidden = false;
    view.rawEmptyEl.textContent = "선택할 사이트가 없습니다.";
    view.rawPreviewEl.hidden = true;
    view.summaryEmptyEl.hidden = false;
    view.summaryEmptyEl.textContent = "선택할 사이트가 없습니다.";
    view.summaryPreviewEl.hidden = true;
    return;
  }

  const logs = allLogs.filter((log) => log.storage_name === storageKey && log.site_id === state.activeSiteId);
  if (logs.length === 0) {
    state.rawId = null;
    state.summaryId = null;
    view.rawListEl.innerHTML = "<div class='empty'>선택한 사이트에 업로드된 로그가 없습니다.</div>";
    view.summaryListEl.innerHTML = "<div class='empty'>선택한 사이트에 업로드된 summary가 없습니다.</div>";
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
    renderStoragePage(storageKey);
    loadRawLog(storageKey, logId);
  });
  renderLogList(view.summaryListEl, logs, state.summaryId, (logId) => {
    state.summaryId = logId;
    renderStoragePage(storageKey);
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
    "<div class='meta'><span>" + escapeHtml(log.site_name || "사이트 미지정") + "</span><span>" + formatBytes(log.size) + "</span></div>" +
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
  view.rawMetaEl.textContent = "상태: " + payload.status + " / 저장 위치: " + toStorageLabel(payload.storage_name) + " > " + (payload.site_name || "사이트 미지정") + " / 크기: " + formatBytes(payload.size);
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
  view.summaryMetaEl.textContent = payload.filename + " / " + toStorageLabel(payload.storage_name) + " > " + (payload.site_name || "사이트 미지정");
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

async function saveStorageSite(storageKey) {
  const view = storageViews[storageKey];
  const siteName = view.siteNameInputEl.value.trim();
  const editId = view.siteEditIdEl.value.trim();
  const isEdit = editId !== "";

  if (siteName === "") {
    view.siteStatusEl.textContent = "사이트 이름을 입력하세요.";
    return;
  }

  view.siteStatusEl.textContent = isEdit ? "사이트 수정 중..." : "사이트 등록 중...";
  const response = await fetch(isEdit ? "/sites/" + editId : "/sites", {
    method: isEdit ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storage_name: storageKey, name: siteName }),
  });
  const payload = await response.json();

  if (response.ok === false) {
    view.siteStatusEl.textContent = payload.detail || "사이트 저장에 실패했습니다.";
    return;
  }

  resetSiteForm(storageKey);
  view.siteStatusEl.textContent = isEdit ? "사이트가 수정되었습니다." : "사이트가 등록되었습니다.";
  storageState[storageKey].activeSiteId = payload.id;
  syncUploadSiteOptions(payload.id, storageKey);
  await loadSites();
  await loadLogs();
}

function populateSiteForm(storageKey, siteId) {
  const target = getSitesByStorage(storageKey).find((site) => site.id === siteId);
  if (!target) {
    return;
  }

  const view = storageViews[storageKey];
  view.siteEditIdEl.value = String(target.id);
  view.siteNameInputEl.value = target.name;
  view.siteStatusEl.textContent = "사이트 이름을 수정한 뒤 저장하세요.";
  const cancelButton = document.querySelector('[data-action="site-cancel-edit"][data-storage="' + storageKey + '"]');
  if (cancelButton !== null) {
    cancelButton.hidden = false;
  }
}

function resetSiteForm(storageKey) {
  const view = storageViews[storageKey];
  view.siteFormEl.reset();
  view.siteEditIdEl.value = "";
  const cancelButton = document.querySelector('[data-action="site-cancel-edit"][data-storage="' + storageKey + '"]');
  if (cancelButton !== null) {
    cancelButton.hidden = true;
  }
}

async function deleteStorageSite(storageKey, siteId) {
  const target = getSitesByStorage(storageKey).find((site) => site.id === siteId);
  if (!target) {
    return;
  }

  const confirmed = window.confirm(target.name + " 사이트를 삭제하시겠습니까?");
  if (confirmed === false) {
    return;
  }

  const response = await fetch("/sites/" + siteId, {
    method: "DELETE",
  });
  const payload = await response.json();

  if (response.ok === false) {
    storageViews[storageKey].siteStatusEl.textContent = payload.detail || "사이트 삭제에 실패했습니다.";
    return;
  }

  if (storageViews[storageKey].siteEditIdEl.value === String(siteId)) {
    resetSiteForm(storageKey);
  }
  storageViews[storageKey].siteStatusEl.textContent = payload.name + " 사이트가 삭제되었습니다.";
  if (storageState[storageKey].activeSiteId === siteId) {
    storageState[storageKey].activeSiteId = null;
  }
  syncUploadSiteOptions();
  await loadSites();
  await loadLogs();
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
  allRequestPosts = Array.isArray(payload) ? payload : [];
  renderFilteredRequestPosts();
}

function renderFilteredRequestPosts() {
  const keyword = requestSearchEl && typeof requestSearchEl.value === "string" ? requestSearchEl.value.trim().toLowerCase() : "";
  const filteredPosts = allRequestPosts.filter((post) => {
    const matchesStatus = activeRequestFilter === "all" || post.status === activeRequestFilter;
    if (!matchesStatus) {
      return false;
    }

    if (keyword === "") {
      return true;
    }

    const haystack = [post.title, post.content, post.author]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });

  renderRequestPosts(filteredPosts);
}

function updateRequestFilterButtons() {
  for (const button of requestFilterButtons) {
    button.classList.toggle("active", (button.dataset.requestFilter || "all") === activeRequestFilter);
  }
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

function syncUploadSiteOptions(preferredSiteId, preferredStorageKey) {
  const storageKey = preferredStorageKey || storageNameEl.value;
  const sites = getSitesByStorage(storageKey);

  if (sites.length === 0) {
    siteIdEl.innerHTML = "<option value=''>먼저 사이트를 등록하세요</option>";
    siteIdEl.value = "";
    return;
  }

  siteIdEl.innerHTML = "<option value=''>사이트를 선택하세요</option>" + sites.map((site) => {
    return "<option value='" + site.id + "'>" + escapeHtml(site.name) + "</option>";
  }).join("");

  const nextSiteId = preferredSiteId || siteIdEl.value || String(sites[0].id);
  if (sites.some((site) => String(site.id) === String(nextSiteId))) {
    siteIdEl.value = String(nextSiteId);
  } else {
    siteIdEl.value = String(sites[0].id);
  }
}

function getSitesByStorage(storageKey) {
  return allSites.filter((site) => site.storage_name === storageKey);
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
