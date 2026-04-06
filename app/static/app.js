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
const openUploadManualFieldsButtonEl = document.getElementById("open-upload-manual-fields");
const manualFieldsModalEl = document.getElementById("manual-fields-modal");
const manualFieldsTitleEl = document.getElementById("manual-fields-title");
const manualFieldsFormEl = document.getElementById("manual-fields-form");
const manualFieldsCloseEl = document.getElementById("manual-fields-close");
const manualFieldsResetEl = document.getElementById("manual-fields-reset");
const manualFieldsStatusEl = document.getElementById("manual-fields-status");

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
const bugFormEl = document.getElementById("bug-form");
const bugEditIdEl = document.getElementById("bug-edit-id");
const bugTitleEl = document.getElementById("bug-title");
const bugContentEl = document.getElementById("bug-content");
const bugStatusMessageEl = document.getElementById("bug-status-message");
const bugListEl = document.getElementById("bug-list");
const bugSubmitButtonEl = document.getElementById("bug-submit-button");
const bugCancelButtonEl = document.getElementById("bug-cancel-button");
const MANUAL_FIELD_KEYS = ["install_date", "warranty", "maintenance", "office_name", "install_rack", "service", "manager_contact", "id_password", "asup", "aggr_diskcount_override"];

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
  bugs: {
    title: "버그 모음",
    description: "운영 중 확인된 버그와 추후 정리할 이슈를 모아봅니다.",
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
    rawListPageEl: getStorageElement(storageKey, "raw-log-list-page"),
    rawDetailPageEl: getStorageElement(storageKey, "raw-log-detail-page"),
    rawNameEl: getStorageElement(storageKey, "raw-name"),
    rawMetaEl: getStorageElement(storageKey, "raw-meta"),
    rawContentEl: getStorageElement(storageKey, "raw-content"),
    summaryListEl: getStorageElement(storageKey, "summary-log-list"),
    summaryListPageEl: getStorageElement(storageKey, "summary-log-list-page"),
    summaryDetailPageEl: getStorageElement(storageKey, "summary-log-detail-page"),
    summaryNameEl: getStorageElement(storageKey, "summary-name"),
    summaryMetaEl: getStorageElement(storageKey, "summary-meta"),
    summaryGridEl: getStorageElement(storageKey, "summary-grid"),
    summaryRawEl: getStorageElement(storageKey, "summary-raw"),
    summaryOverviewPageEl: getStorageElement(storageKey, "summary-overview-page"),
    summarySectionPageEl: getStorageElement(storageKey, "summary-section-page"),
    summarySectionTitleEl: getStorageElement(storageKey, "summary-section-title"),
    summarySectionMessageEl: getStorageElement(storageKey, "summary-section-message"),
    eventLogFilterTabsEl: getStorageElement(storageKey, "event-log-filter-tabs"),
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
    activeSummarySection: "overview",
    activeEventLogFilter: "all",
    currentSummarySections: {},
    currentSpecialNotes: [],
    specialNoteDraft: "",
    specialNoteSourceId: "",
    currentManualFields: createEmptyManualFields(),
  };
}

let allLogs = [];
let allSites = [];
let allRequestPosts = [];
let allBugPosts = [];
let activeRequestFilter = "all";
let uploadManualFields = createEmptyManualFields();
let manualFieldsModalMode = "upload";
let manualFieldsModalTarget = { storageKey: null, logId: null };

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

if (openUploadManualFieldsButtonEl !== null) {
  openUploadManualFieldsButtonEl.addEventListener("click", () => {
    openManualFieldsModal("upload");
  });
}

if (manualFieldsCloseEl !== null) {
  manualFieldsCloseEl.addEventListener("click", closeManualFieldsModal);
}

if (manualFieldsResetEl !== null) {
  manualFieldsResetEl.addEventListener("click", () => {
    fillManualFieldsForm(createEmptyManualFields());
    manualFieldsStatusEl.textContent = "입력값을 비웠습니다.";
  });
}

if (manualFieldsFormEl !== null) {
  manualFieldsFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = getManualFieldsFromForm();

    if (manualFieldsModalMode === "upload") {
      uploadManualFields = fields;
      manualFieldsStatusEl.textContent = "업로드용 직접 입력 항목을 저장했습니다.";
      window.setTimeout(closeManualFieldsModal, 250);
      return;
    }

    if (manualFieldsModalTarget.storageKey === null || manualFieldsModalTarget.logId === null) {
      manualFieldsStatusEl.textContent = "수정할 요약 로그를 찾을 수 없습니다.";
      return;
    }

    manualFieldsStatusEl.textContent = "직접 입력 항목 저장 중...";
    const response = await fetch("/logs/" + manualFieldsModalTarget.logId + "/manual-fields", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manual_fields: fields }),
    });
    const payload = await response.json();
    if (response.ok === false) {
      manualFieldsStatusEl.textContent = payload.detail || "직접 입력 항목 저장에 실패했습니다.";
      return;
    }

    storageState[manualFieldsModalTarget.storageKey].currentManualFields = payload.manual_fields || createEmptyManualFields();
    manualFieldsStatusEl.textContent = "직접 입력 항목을 저장했습니다.";
    await loadSummary(manualFieldsModalTarget.storageKey, manualFieldsModalTarget.logId);
    window.setTimeout(closeManualFieldsModal, 250);
  });
}

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
  formData.append("manual_fields_json", JSON.stringify(uploadManualFields));
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
    uploadManualFields = createEmptyManualFields();
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

if (bugFormEl !== null) {
  bugFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = bugTitleEl.value.trim();
    const content = bugContentEl.value.trim();
    const editId = bugEditIdEl.value.trim();
    const author = localStorage.getItem(SESSION_NAME_KEY) || localStorage.getItem(SESSION_KEY);

    if (title === "" || content === "") {
      bugStatusMessageEl.textContent = "제목과 내용을 모두 입력하세요.";
      return;
    }

    const isEdit = editId !== "";
    bugStatusMessageEl.textContent = isEdit ? "버그 글 저장 중..." : "버그 글 등록 중...";

    const response = await fetch(isEdit ? "/bugs/" + editId : "/bugs", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, author }),
    });
    const payload = await response.json();

    if (response.ok === false) {
      bugStatusMessageEl.textContent = payload.detail || "버그 글 저장에 실패했습니다.";
      return;
    }

    resetBugForm();
    bugStatusMessageEl.textContent = isEdit ? "버그 글이 업데이트되었습니다." : "버그 글이 등록되었습니다.";
    await loadBugPosts();
  });
}

if (bugCancelButtonEl !== null) {
  bugCancelButtonEl.addEventListener("click", () => {
    resetBugForm();
    bugStatusMessageEl.textContent = "수정 모드를 취소했습니다.";
  });
}

document.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton === null) {
    return;
  }

  const action = actionButton.dataset.action;
  const storageKey = actionButton.dataset.storage;

  if (action === "download-log-item") {
    const logId = Number(actionButton.dataset.id);
    if (Number.isNaN(logId) === false) {
      window.location.href = "/logs/" + logId + "/download";
    }
    return;
  }

  if (action === "delete-log-item") {
    await deleteSelectedLog(Number(actionButton.dataset.id), storageKey);
    return;
  }

  if (action === "download-raw") {
    const logId = storageState[storageKey].rawId;
    if (logId !== null) {
      window.location.href = "/logs/" + logId + "/download";
    }
    return;
  }

  if (action === "download-summary") {
    const logId = storageState[storageKey].summaryId;
    if (logId !== null) {
      window.location.href = "/logs/" + logId + "/download";
    }
    return;
  }

  if (action === "delete-raw") {
    await deleteSelectedLog(storageState[storageKey].rawId, storageKey);
    return;
  }

  if (action === "delete-summary") {
    await deleteSelectedLog(storageState[storageKey].summaryId, storageKey);
    return;
  }

  if (action === "open-raw-log") {
    storageState[storageKey].rawId = Number(actionButton.dataset.id);
    renderStoragePage(storageKey);
    return;
  }

  if (action === "open-summary-log") {
    storageState[storageKey].summaryId = Number(actionButton.dataset.id);
    storageState[storageKey].activeSummarySection = "overview";
    renderStoragePage(storageKey);
    return;
  }

  if (action === "raw-log-list-back") {
    storageState[storageKey].rawId = null;
    renderStoragePage(storageKey);
    return;
  }

  if (action === "summary-log-list-back") {
    storageState[storageKey].summaryId = null;
    storageState[storageKey].activeSummarySection = "overview";
    renderStoragePage(storageKey);
    return;
  }

  if (action === "edit-manual-fields") {
    const logId = storageState[storageKey].summaryId;
    if (logId !== null) {
      openManualFieldsModal("edit", storageKey, logId);
    }
    return;
  }

  if (action === "summary-section-view") {
    storageState[storageKey].activeSummarySection = actionButton.dataset.summarySection || "overview";
    if (storageState[storageKey].activeSummarySection === "Event log") {
      storageState[storageKey].activeEventLogFilter = "all";
    }
    renderSummarySectionView(storageKey);
    return;
  }

  if (action === "event-log-filter") {
    storageState[storageKey].activeEventLogFilter = actionButton.dataset.eventLogFilter || "all";
    renderSummarySectionView(storageKey);
    return;
  }

  if (action === "special-note-edit") {
    const noteId = actionButton.dataset.noteId || "";
    const notes = storageState[storageKey].currentSpecialNotes || [];
    const target = notes.find((note) => note.id === noteId);
    if (target) {
      storageState[storageKey].specialNoteDraft = target.content || "";
      storageState[storageKey].specialNoteSourceId = target.id || "";
      renderSummarySectionView(storageKey);
    }
    return;
  }

  if (action === "special-note-reset") {
    storageState[storageKey].specialNoteDraft = "";
    storageState[storageKey].specialNoteSourceId = "";
    renderSummarySectionView(storageKey);
    return;
  }

  if (action === "special-note-save") {
    const logId = storageState[storageKey].summaryId;
    if (logId === null) {
      return;
    }

    const textarea = document.querySelector('[data-role="special-note-input"][data-storage="' + storageKey + '"]');
    const statusEl = document.querySelector('[data-role="special-note-status"][data-storage="' + storageKey + '"]');
    const content = textarea ? textarea.value.trim() : "";
    if (content === "") {
      if (statusEl !== null) {
        statusEl.textContent = "특이사항 내용을 입력하세요.";
      }
      return;
    }

    if (statusEl !== null) {
      statusEl.textContent = "특이사항 저장 중...";
    }

    const response = await fetch("/logs/" + logId + "/special-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        author: localStorage.getItem(SESSION_NAME_KEY) || localStorage.getItem(SESSION_KEY) || "",
        source_note_id: storageState[storageKey].specialNoteSourceId || null,
      }),
    });
    const payload = await response.json();

    if (response.ok === false) {
      if (statusEl !== null) {
        statusEl.textContent = payload.detail || "특이사항 저장에 실패했습니다.";
      }
      return;
    }

    storageState[storageKey].currentSpecialNotes = payload.special_notes || [];
    storageState[storageKey].specialNoteDraft = "";
    storageState[storageKey].specialNoteSourceId = "";
    renderSummarySectionView(storageKey);
    const nextStatusEl = document.querySelector('[data-role="special-note-status"][data-storage="' + storageKey + '"]');
    if (nextStatusEl !== null) {
      nextStatusEl.textContent = "특이사항 이력이 저장되었습니다.";
    }
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

  if (action === "bug-edit") {
    populateBugForm(Number(actionButton.dataset.id));
    return;
  }

  if (action === "bug-delete") {
    await deleteBugPost(Number(actionButton.dataset.id));
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
  await Promise.all([loadLogs(), loadRequestPosts(), loadBugPosts()]);
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
    toggleLogDetailPage(storageKey, "raw", false);
    toggleLogDetailPage(storageKey, "summary", false);
    return;
  }

  const logs = allLogs.filter((log) => log.storage_name === storageKey && log.site_id === state.activeSiteId);
  if (logs.length === 0) {
    state.rawId = null;
    state.summaryId = null;
    view.rawListEl.innerHTML = "<div class='empty'>선택한 사이트에 업로드된 로그가 없습니다.</div>";
    view.summaryListEl.innerHTML = "<div class='empty'>선택한 사이트에 업로드된 summary가 없습니다.</div>";
    toggleLogDetailPage(storageKey, "raw", false);
    toggleLogDetailPage(storageKey, "summary", false);
    return;
  }

  const availableIds = logs.map((log) => log.id);
  if (availableIds.includes(state.rawId) === false) {
    state.rawId = null;
  }
  if (availableIds.includes(state.summaryId) === false) {
    state.summaryId = null;
  }

  renderLogListPage(storageKey, "raw", logs, state.rawId);
  renderLogListPage(storageKey, "summary", logs, state.summaryId);

  if (state.rawId !== null) {
    loadRawLog(storageKey, state.rawId);
  } else {
    toggleLogDetailPage(storageKey, "raw", false);
  }

  if (state.summaryId !== null) {
    loadSummary(storageKey, state.summaryId);
  } else {
    toggleLogDetailPage(storageKey, "summary", false);
  }
}

function renderLogListPage(storageKey, type, logs, activeId) {
  const view = storageViews[storageKey];
  const container = type === "raw" ? view.rawListEl : view.summaryListEl;
  const action = type === "raw" ? "open-raw-log" : "open-summary-log";
  container.innerHTML = logs.map((log) => {
    const activeClass = log.id === activeId ? " active" : "";
    return "<button class='log-item " + activeClass + "' data-action='" + action + "' data-storage='" + storageKey + "' data-id='" + log.id + "' type='button'>" +
      "<strong>" + escapeHtml(type === "raw" ? log.filename : log.filename + "_summary") + "</strong>" +
      "<div class='meta'><span>" + escapeHtml(formatDate(log.created_at)) + "</span><span>" + formatBytes(log.size) + "</span></div>" +
    "</button>";
  }).join("");
}

function toggleLogDetailPage(storageKey, type, showDetail) {
  const view = storageViews[storageKey];
  const listPageEl = type === "raw" ? view.rawListPageEl : view.summaryListPageEl;
  const detailPageEl = type === "raw" ? view.rawDetailPageEl : view.summaryDetailPageEl;
  if (listPageEl !== null) {
    listPageEl.hidden = showDetail;
  }
  if (detailPageEl !== null) {
    detailPageEl.hidden = !showDetail;
  }
}

async function loadRawLog(storageKey, logId) {
  const view = storageViews[storageKey];
  const response = await fetch("/logs/" + logId + "/raw");
  const payload = await response.json();

  if (response.ok === false) {
    toggleLogDetailPage(storageKey, "raw", false);
    view.rawListEl.innerHTML = "<div class='empty'>" + escapeHtml(payload.detail || "원본 로그를 불러오지 못했습니다.") + "</div>";
    return;
  }

  toggleLogDetailPage(storageKey, "raw", true);
  view.rawNameEl.textContent = payload.filename;
  view.rawMetaEl.textContent = "상태: " + payload.status + " / 저장 위치: " + toStorageLabel(payload.storage_name) + " > " + (payload.site_name || "사이트 미지정") + " / 크기: " + formatBytes(payload.size);
  view.rawContentEl.textContent = payload.raw_text || "";
}

async function loadSummary(storageKey, logId) {
  const view = storageViews[storageKey];
  const response = await fetch("/logs/" + logId + "/summary");
  const payload = await response.json();

  if (response.ok === false) {
    toggleLogDetailPage(storageKey, "summary", false);
    view.summaryListEl.innerHTML = "<div class='empty'>" + escapeHtml(payload.detail || "summary를 불러오지 못했습니다.") + "</div>";
    return;
  }

  toggleLogDetailPage(storageKey, "summary", true);
  view.summaryNameEl.textContent = payload.summary_filename;
  view.summaryMetaEl.textContent = payload.filename + " / " + toStorageLabel(payload.storage_name) + " > " + (payload.site_name || "사이트 미지정");
  view.summaryGridEl.innerHTML = renderSummaryFieldsMarkup(payload.summary || {});
  view.summaryRawEl.textContent = payload.raw_text || "";
  storageState[storageKey].currentSummarySections = payload.section_contents || {};
  storageState[storageKey].currentSpecialNotes = (payload.section_contents && payload.section_contents["특이사항"]) || [];
  storageState[storageKey].currentManualFields = payload.manual_fields || createEmptyManualFields();
  storageState[storageKey].specialNoteDraft = "";
  storageState[storageKey].specialNoteSourceId = "";
  renderSummarySectionView(storageKey);
}

function renderSummaryFieldsMarkup(summary) {
  const entries = Object.entries(summary);
  if (entries.length === 0) {
    return "<div class='summary-field'><strong>summary</strong><span>표시할 데이터가 없습니다.</span></div>";
  }

  return entries.map(([key, value]) => {
    const safeValue = value === null || value === undefined || value === "" ? "-" : String(value);
    return "<div class='summary-field'><strong>" + escapeHtml(key) + "</strong><span>" + escapeHtml(safeValue) + "</span></div>";
  }).join("");
}

function renderSummarySectionView(storageKey) {
  const view = storageViews[storageKey];
  const activeSection = storageState[storageKey].activeSummarySection || "overview";
  const eventLogFiltersEl = view.eventLogFilterTabsEl;

  if (view.summaryOverviewPageEl !== null) {
    view.summaryOverviewPageEl.hidden = activeSection !== "overview";
  }
  if (view.summarySectionPageEl !== null) {
    view.summarySectionPageEl.hidden = activeSection === "overview";
  }
  if (eventLogFiltersEl !== null && activeSection === "overview") {
    eventLogFiltersEl.hidden = true;
  }
  if (activeSection !== "overview") {
    const sectionContents = storageState[storageKey].currentSummarySections || {};
    let sectionText = sectionContents[activeSection] || "";
    let useHtmlRender = false;

    if (activeSection === "Event log" && eventLogFiltersEl !== null) {
      const activeEventLogFilter = storageState[storageKey].activeEventLogFilter || "all";
      eventLogFiltersEl.hidden = false;
      if (typeof sectionText === "object" && sectionText !== null) {
        sectionText = sectionText[activeEventLogFilter] || "";
        useHtmlRender = activeEventLogFilter !== "all";
      }
      const filterButtons = eventLogFiltersEl.querySelectorAll('[data-action="event-log-filter"]');
      for (const button of filterButtons) {
        button.classList.toggle("active", (button.dataset.eventLogFilter || "all") === activeEventLogFilter);
      }
    } else if (eventLogFiltersEl !== null) {
      eventLogFiltersEl.hidden = true;
    }

    view.summarySectionTitleEl.textContent = activeSection;
    if (activeSection === "특이사항") {
      view.summarySectionMessageEl.innerHTML = renderSpecialNotesMarkup(storageKey);
    } else if (useHtmlRender) {
      view.summarySectionMessageEl.innerHTML = renderEventLogEntriesMarkup(sectionText);
    } else {
      view.summarySectionMessageEl.textContent = sectionText || activeSection + " 페이지는 다음 단계에서 구성할 예정입니다.";
    }
  }

  const buttons = document.querySelectorAll('[data-action="summary-section-view"][data-storage="' + storageKey + '"]');
  for (const button of buttons) {
    button.classList.toggle("active", (button.dataset.summarySection || "overview") === activeSection);
  }
}

function renderSpecialNotesMarkup(storageKey) {
  const state = storageState[storageKey];
  const notes = state.currentSpecialNotes || [];
  const draftValue = state.specialNoteDraft || "";
  const sourceLabel = state.specialNoteSourceId ? "수정 이력 추가" : "새 특이사항 추가";

  const formMarkup =
    "<div class='special-notes-panel'>" +
      "<div class='special-note-form'>" +
        "<strong>" + sourceLabel + "</strong>" +
        "<textarea data-role='special-note-input' data-storage='" + storageKey + "' placeholder='특이사항을 입력하세요'>" + escapeHtml(draftValue) + "</textarea>" +
        "<div class='special-note-actions'>" +
          "<button class='secondary' data-action='special-note-reset' data-storage='" + storageKey + "' type='button'>초기화</button>" +
          "<button data-action='special-note-save' data-storage='" + storageKey + "' type='button'>저장</button>" +
        "</div>" +
        "<p class='status' data-role='special-note-status' data-storage='" + storageKey + "'></p>" +
      "</div>";

  if (notes.length === 0) {
    return formMarkup + "<div class='empty'>아직 등록된 특이사항이 없습니다.</div></div>";
  }

  const historyMarkup = notes.map((note) => {
    const author = note.author ? note.author : "작성자 미지정";
    const createdAt = note.created_at ? formatDate(note.created_at) : "-";
    return (
      "<article class='special-note-card'>" +
        "<div class='special-note-head'>" +
          "<strong>" + escapeHtml(author) + "</strong>" +
          "<span>" + escapeHtml(createdAt) + "</span>" +
        "</div>" +
        "<div class='special-note-body'>" + escapeHtml(note.content || "") + "</div>" +
        "<div class='special-note-actions'>" +
          "<button class='secondary' data-action='special-note-edit' data-storage='" + storageKey + "' data-note-id='" + escapeHtml(note.id || "") + "' type='button'>이 내용으로 수정</button>" +
        "</div>" +
      "</article>"
    );
  }).join("");

  return formMarkup + "<div class='special-note-history'>" + historyMarkup + "</div></div>";
}

function renderEventLogEntriesMarkup(sectionText) {
  const categories = sectionText && Array.isArray(sectionText.categories) ? sectionText.categories : [];

  if (categories.length === 0) {
    return "<div class='empty'>표시할 이벤트가 없습니다.</div>";
  }

  return "<div class='event-log-category-list'>" + categories.map((category, categoryIndex) => {
    const code = category.code || "이벤트";
    const entries = Array.isArray(category.entries) ? category.entries : [];
    const entriesMarkup = entries.map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(ALERT|ERROR|EMERGENCY)\s+(.+)$/i);
      if (!match) {
        return "<article class='event-log-card'><div class='event-log-detail'>" + escapeHtml(line) + "</div></article>";
      }

      const eventDate = match[1];
      const eventTime = match[2];
      const nodeName = match[3];
      const severity = match[4].toUpperCase();
      const message = match[5];
      const codeMatch = message.match(/^([^:]+):\s*(.*)$/);
      const eventDetail = codeMatch ? codeMatch[2] : "";

      return (
        "<article class='event-log-card'>" +
          "<div class='event-log-head'>" +
            "<strong>" + escapeHtml(code) + "</strong>" +
            "<span class='event-log-badge'>" + escapeHtml(severity) + "</span>" +
          "</div>" +
          "<div class='event-log-meta'>" + escapeHtml(eventDate + " " + eventTime + " / " + nodeName) + "</div>" +
          "<div class='event-log-detail'>" + escapeHtml(eventDetail || message) + "</div>" +
        "</article>"
      );
    }).join("");

    return (
      "<details class='event-log-category' " + (categoryIndex === 0 ? "open" : "") + ">" +
        "<summary>" +
          "<strong>" + escapeHtml(code) + "</strong>" +
          "<span>" + escapeHtml(String(entries.length)) + "건</span>" +
        "</summary>" +
        "<div class='event-log-list'>" + entriesMarkup + "</div>" +
      "</details>"
    );
  }).join("") + "</div>";
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
  if (logId === null || Number.isNaN(logId)) {
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

  if (storageState[storageKey].rawId === logId) {
    storageState[storageKey].rawId = null;
  }
  if (storageState[storageKey].summaryId === logId) {
    storageState[storageKey].summaryId = null;
  }
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

async function loadBugPosts() {
  const response = await fetch("/bugs");
  const payload = await response.json();
  allBugPosts = Array.isArray(payload) ? payload : [];
  renderBugPosts(allBugPosts);
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

function renderBugPosts(posts) {
  if (bugListEl === null) {
    return;
  }

  if (posts.length === 0) {
    bugListEl.innerHTML = "<div class='empty'>등록된 버그가 없습니다.</div>";
    return;
  }

  bugListEl.innerHTML = posts.map((post) => {
    return "<article class='request-card'>" +
      "<div class='request-top'>" +
        "<div class='request-header'><span class='badge doing'>버그</span></div>" +
        "<div class='request-actions'>" +
          "<button class='secondary' data-action='bug-edit' data-id='" + post.id + "' type='button'>수정</button>" +
          "<button class='danger' data-action='bug-delete' data-id='" + post.id + "' type='button'>삭제</button>" +
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

function populateBugForm(postId) {
  const target = allBugPosts.find((post) => post.id === postId);
  if (!target) {
    return;
  }
  bugEditIdEl.value = String(target.id);
  bugTitleEl.value = target.title;
  bugContentEl.value = target.content;
  bugSubmitButtonEl.textContent = "수정 저장";
  bugCancelButtonEl.hidden = false;
  bugStatusMessageEl.textContent = "수정할 내용을 편집한 뒤 저장하세요.";
  showPage("bugs");
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

async function deleteBugPost(postId) {
  const confirmed = window.confirm("이 버그 글을 삭제하시겠습니까?");
  if (confirmed === false) {
    return;
  }

  const response = await fetch("/bugs/" + postId, {
    method: "DELETE",
  });
  const payload = await response.json();

  if (response.ok === false) {
    bugStatusMessageEl.textContent = payload.detail || "버그 글 삭제에 실패했습니다.";
    return;
  }

  if (bugEditIdEl.value === String(postId)) {
    resetBugForm();
  }
  bugStatusMessageEl.textContent = payload.title + " 글이 삭제되었습니다.";
  await loadBugPosts();
}

function resetRequestForm() {
  requestFormEl.reset();
  requestEditIdEl.value = "";
  requestSubmitButtonEl.textContent = "등록";
  requestCancelButtonEl.hidden = true;
}

function resetBugForm() {
  if (bugFormEl === null) {
    return;
  }
  bugFormEl.reset();
  bugEditIdEl.value = "";
  bugSubmitButtonEl.textContent = "등록";
  bugCancelButtonEl.hidden = true;
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

function createEmptyManualFields() {
  const fields = {};
  for (const key of MANUAL_FIELD_KEYS) {
    fields[key] = "";
  }
  return fields;
}

function fillManualFieldsForm(fields) {
  const values = fields || createEmptyManualFields();
  for (const key of MANUAL_FIELD_KEYS) {
    const input = manualFieldsFormEl.elements.namedItem(key);
    if (input && "value" in input) {
      input.value = values[key] || "";
    }
  }
}

function getManualFieldsFromForm() {
  const fields = {};
  for (const key of MANUAL_FIELD_KEYS) {
    const input = manualFieldsFormEl.elements.namedItem(key);
    fields[key] = input && "value" in input && typeof input.value === "string" ? input.value.trim() : "";
  }
  return fields;
}

function openManualFieldsModal(mode, storageKey, logId) {
  manualFieldsModalMode = mode;
  manualFieldsModalTarget = { storageKey: storageKey || null, logId: logId || null };
  manualFieldsStatusEl.textContent = "";
  if (mode === "edit" && storageKey !== null) {
    manualFieldsTitleEl.textContent = "요약 로그 직접 입력 수정";
    fillManualFieldsForm(storageState[storageKey].currentManualFields || createEmptyManualFields());
  } else {
    manualFieldsTitleEl.textContent = "업로드 직접 입력 항목";
    fillManualFieldsForm(uploadManualFields);
  }
  manualFieldsModalEl.hidden = false;
}

function closeManualFieldsModal() {
  manualFieldsModalEl.hidden = true;
  manualFieldsStatusEl.textContent = "";
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
