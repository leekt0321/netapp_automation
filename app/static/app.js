import {
  ADMIN_REFRESH_INTERVAL_MS,
  ALLOWED_UPLOAD_EXTENSIONS,
  MANUAL_FIELD_KEYS,
  SESSION_USER_STORAGE_KEY,
  STORAGE_KEYS,
  pageMeta,
} from "/static/js/constants.js";
import {
  activeSessionListEl,
  appShellEl,
  bugCancelButtonEl,
  bugContentEl,
  bugEditIdEl,
  bugFormEl,
  bugListEl,
  bugCountEl,
  bugSearchEl,
  bugStatusMessageEl,
  bugSubmitButtonEl,
  bugTitleEl,
  changePasswordFormEl,
  changePasswordFormMembersEl,
  changePasswordStatusEl,
  changePasswordStatusMembersEl,
  createStorageViews,
  currentPasswordEl,
  currentPasswordMembersEl,
  deleteFormEl,
  deleteFormMembersEl,
  deletePasswordEl,
  deletePasswordMembersEl,
  deleteStatusEl,
  deleteStatusMembersEl,
  deletionRequestListEl,
  fileInputEl,
  latestLogNameEl,
  loginFormEl,
  loginIdEl,
  loginPasswordEl,
  loginScreenEl,
  loginStatusEl,
  loginUserEl,
  logoutButtonEl,
  manualFieldsCloseEl,
  manualFieldsFormEl,
  manualFieldsModalEl,
  manualFieldsResetEl,
  manualFieldsStatusEl,
  manualFieldsTitleEl,
  memberCountEl,
  memberListEl,
  navButtons,
  newPasswordEl,
  newPasswordMembersEl,
  openUploadManualFieldsButtonEl,
  pageDescriptionEl,
  pageSections,
  pageTitleEl,
  registerFormEl,
  registerIdEl,
  registerNameEl,
  registerPasswordEl,
  registerStatusEl,
  requestCancelButtonEl,
  requestContentEl,
  requestEditIdEl,
  requestFilterButtons,
  requestFormEl,
  requestListEl,
  requestCountEl,
  requestSearchEl,
  requestStatusEl,
  requestStatusMessageEl,
  requestSubmitButtonEl,
  requestTitleEl,
  siteIdEl,
  statusEl,
  storageNameEl,
  totalLogCountEl,
  uploadFileListEl,
  uploadFormEl,
} from "/static/js/dom.js";
import {
  createEmptyManualFields,
  escapeHtml,
  formatBytes,
  formatDate,
  getStatusBadgeClass,
  isDesktopLogSplitView,
  toStorageLabel,
} from "/static/js/utils.js";
import { createAppState, createStorageState } from "/static/js/state.js";
import { deleteJson, getJson, postForm, postJson, putJson } from "/static/js/api.js";
import {
  applyHistoryState as applyHistoryStateModule,
  getHistoryStateSnapshot as getHistoryStateSnapshotModule,
  syncHistoryState as syncHistoryStateModule,
} from "/static/js/history.js";

const storageViews = createStorageViews(STORAGE_KEYS);
const storageState = createStorageState(STORAGE_KEYS, createEmptyManualFields);
const appState = createAppState(createEmptyManualFields, isDesktopLogSplitView);
let allLogs = appState.allLogs;
let allSites = appState.allSites;
let allRequestPosts = appState.allRequestPosts;
let allBugPosts = appState.allBugPosts;
let allUsers = appState.allUsers;
let allActiveSessions = appState.allActiveSessions;
let allDeletionRequests = appState.allDeletionRequests;
let activeRequestFilter = appState.activeRequestFilter;
let uploadManualFields = appState.uploadManualFields;
let manualFieldsModalMode = appState.manualFieldsModalMode;
let manualFieldsModalTarget = appState.manualFieldsModalTarget;
let currentPage = appState.currentPage;
let isApplyingHistoryState = appState.isApplyingHistoryState;
let lastHistorySnapshot = appState.lastHistorySnapshot;
let lastLogLayoutMode = appState.lastLogLayoutMode;
let currentUser = appState.currentUser;
let adminRefreshTimerId = appState.adminRefreshTimerId;

function hasAllowedUploadExtension(filename) {
  const lowerName = typeof filename === "string" ? filename.toLowerCase() : "";
  return ALLOWED_UPLOAD_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
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
  const { response, payload } = await postJson("/auth/login", { username, password });

  if (response.ok === false) {
    loginStatusEl.textContent = payload.detail || "로그인에 실패했습니다.";
    return;
  }

  loginStatusEl.textContent = "";
  loginFormEl.reset();
  openApp(payload);
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
  const { response, payload } = await postJson("/auth/register", { username, password, full_name: fullName || null });

  if (response.ok === false) {
    registerStatusEl.textContent = payload.detail || "회원가입에 실패했습니다.";
    return;
  }

  registerStatusEl.textContent = payload.username + " 계정이 생성되었습니다. 관리자 승인 후 로그인할 수 있습니다.";
  registerFormEl.reset();
  if (appShellEl.hidden === false) {
    await loadUsers();
  }
});

logoutButtonEl.addEventListener("click", () => {
  logoutCurrentUser();
});

deleteFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitDeleteAccount(deletePasswordEl, deleteStatusEl, deleteFormEl);
});

if (deleteFormMembersEl !== null) {
  deleteFormMembersEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitDeleteAccount(deletePasswordMembersEl, deleteStatusMembersEl, deleteFormMembersEl);
  });
}

if (changePasswordFormEl !== null) {
  changePasswordFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitChangePassword(changePasswordFormEl, currentPasswordEl, newPasswordEl, changePasswordStatusEl);
  });
}

if (changePasswordFormMembersEl !== null) {
  changePasswordFormMembersEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitChangePassword(changePasswordFormMembersEl, currentPasswordMembersEl, newPasswordMembersEl, changePasswordStatusMembersEl);
  });
}

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
    const { response, payload } = await putJson("/logs/" + manualFieldsModalTarget.logId + "/manual-fields", { manual_fields: fields });
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

if (bugSearchEl !== null) {
  bugSearchEl.addEventListener("input", () => {
    renderFilteredBugPosts();
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
  if (selectedFiles.some((selectedFile) => !hasAllowedUploadExtension(selectedFile.name))) {
    statusEl.textContent = "업로드 가능한 파일 형식은 .log, .txt 뿐입니다.";
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
  if (saveNames.some((value) => !hasAllowedUploadExtension(value))) {
    statusEl.textContent = "저장 이름도 .log 또는 .txt 확장자만 사용할 수 있습니다.";
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
    const { response, payload } = await postForm("/upload", formData);
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
  const author = getCurrentDisplayName();

  if (title === "" || content === "") {
    requestStatusMessageEl.textContent = "제목과 내용을 모두 입력하세요.";
    return;
  }

  const isEdit = editId !== "";
  requestStatusMessageEl.textContent = isEdit ? "수정 요청 저장 중..." : "수정 요청 등록 중...";

  const requestUrl = isEdit ? "/requests/" + editId : "/requests";
  const requestCall = isEdit ? putJson : postJson;
  const { response, payload } = await requestCall(requestUrl, { title, content, status, author });

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
  const author = getCurrentDisplayName();

    if (title === "" || content === "") {
      bugStatusMessageEl.textContent = "제목과 내용을 모두 입력하세요.";
      return;
    }

    const isEdit = editId !== "";
    bugStatusMessageEl.textContent = isEdit ? "버그 글 저장 중..." : "버그 글 등록 중...";

    const bugUrl = isEdit ? "/bugs/" + editId : "/bugs";
    const bugCall = isEdit ? putJson : postJson;
    const { response, payload } = await bugCall(bugUrl, { title, content, author });

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
    await requestSelectedLogDeletion(Number(actionButton.dataset.id));
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
    await requestSelectedLogDeletion(storageState[storageKey].rawId);
    return;
  }

  if (action === "delete-summary") {
    await requestSelectedLogDeletion(storageState[storageKey].summaryId);
    return;
  }

  if (action === "open-raw-log") {
    storageState[storageKey].rawId = Number(actionButton.dataset.id);
    renderStoragePage(storageKey);
    syncHistoryState("push");
    return;
  }

  if (action === "open-summary-log") {
    storageState[storageKey].summaryId = Number(actionButton.dataset.id);
    storageState[storageKey].activeSummarySection = "overview";
    renderStoragePage(storageKey);
    syncHistoryState("push");
    return;
  }

  if (action === "raw-log-list-back") {
    storageState[storageKey].rawId = null;
    renderStoragePage(storageKey);
    syncHistoryState("push");
    return;
  }

  if (action === "summary-log-list-back") {
    storageState[storageKey].summaryId = null;
    storageState[storageKey].activeSummarySection = "overview";
    renderStoragePage(storageKey);
    syncHistoryState("push");
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
    syncHistoryState("push");
    return;
  }

  if (action === "event-log-filter") {
    storageState[storageKey].activeEventLogFilter = actionButton.dataset.eventLogFilter || "all";
    renderSummarySectionView(storageKey);
    syncHistoryState("push");
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
        author: getCurrentDisplayName(),
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
    syncHistoryState("push");
    return;
  }

  if (action === "storage-back") {
    storageState[storageKey].activeView = "sites";
    renderStorageSubViews(storageKey);
    syncHistoryState("push");
    return;
  }

  if (action === "storage-log-view") {
    storageState[storageKey].activeLogView = actionButton.dataset.logView === "summary" ? "summary" : "raw";
    renderStorageLogView(storageKey);
    syncHistoryState("push");
    return;
  }

  if (action === "log-page-prev" || action === "log-page-next") {
    const pageKey = actionButton.dataset.logType === "summary" ? "summaryPage" : "rawPage";
    const delta = action === "log-page-next" ? 1 : -1;
    storageState[storageKey][pageKey] = Math.max(1, storageState[storageKey][pageKey] + delta);
    renderStoragePage(storageKey);
    return;
  }

  if (action === "site-edit") {
    if (isAdmin() === false) {
      return;
    }
    populateSiteForm(storageKey, Number(actionButton.dataset.id));
    return;
  }

  if (action === "site-delete") {
    if (isAdmin() === false) {
      return;
    }
    await deleteStorageSite(storageKey, Number(actionButton.dataset.id));
    return;
  }

  if (action === "bug-edit") {
    if (isAuthenticated() === false) {
      return;
    }
    populateBugForm(Number(actionButton.dataset.id));
    return;
  }

  if (action === "bug-delete") {
    if (isAuthenticated() === false) {
      return;
    }
    await deleteBugPost(Number(actionButton.dataset.id));
    return;
  }

  if (action === "site-cancel-edit") {
    resetSiteForm(storageKey);
    return;
  }

  if (action === "request-edit") {
    if (isAuthenticated() === false) {
      return;
    }
    populateRequestForm(Number(actionButton.dataset.id));
    return;
  }

  if (action === "request-delete") {
    if (isAuthenticated() === false) {
      return;
    }
    await deleteRequestPost(Number(actionButton.dataset.id));
    return;
  }

  if (action === "toggle-user-status") {
    await updateUserStatus(Number(actionButton.dataset.userId), actionButton.dataset.nextActive === "true");
    return;
  }

  if (action === "approve-deletion-request") {
    await reviewDeletionRequest(Number(actionButton.dataset.requestId), "approve");
    return;
  }

  if (action === "reject-deletion-request") {
    await reviewDeletionRequest(Number(actionButton.dataset.requestId), "reject");
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.dataset.action === "log-search") {
    const storageKey = target.dataset.storage;
    storageState[storageKey].logSearchQuery = target.value.trim();
    storageState[storageKey].rawPage = 1;
    storageState[storageKey].summaryPage = 1;
    renderStoragePage(storageKey);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }
  const storageKey = target.dataset.storage;
  if (!storageKey) {
    return;
  }
  if (target.dataset.action === "log-sort") {
    storageState[storageKey].logSortMode = target.value;
    storageState[storageKey].rawPage = 1;
    storageState[storageKey].summaryPage = 1;
    renderStoragePage(storageKey);
    return;
  }
  if (target.dataset.action === "log-page-size") {
    const parsed = Number(target.value);
    storageState[storageKey].pageSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    storageState[storageKey].rawPage = 1;
    storageState[storageKey].summaryPage = 1;
    renderStoragePage(storageKey);
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
  if (selectedFiles.some((selectedFile) => !hasAllowedUploadExtension(selectedFile.name))) {
    uploadFileListEl.innerHTML = "<div class='empty'>.log 또는 .txt 파일만 선택할 수 있습니다.</div>";
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
  stopAdminRefresh();
  currentUser = null;
  allUsers = [];
  allActiveSessions = [];
  allDeletionRequests = [];
  window.localStorage.removeItem(SESSION_USER_STORAGE_KEY);
  appShellEl.hidden = true;
  loginScreenEl.hidden = false;
  applyRolePermissions();
}

function isAdmin() {
  return currentUser !== null && currentUser.role === "admin";
}

function isAuthenticated() {
  return currentUser !== null;
}

function getCurrentDisplayName() {
  if (currentUser === null) {
    return "";
  }
  return currentUser.display_name || currentUser.full_name || currentUser.username || "";
}

function applyRolePermissions() {
  const adminOnlyElements = Array.from(document.querySelectorAll('[data-admin-only="true"]'));
  const admin = isAdmin();
  for (const element of adminOnlyElements) {
    element.hidden = !admin;
  }
  if (memberCountEl !== null) {
    memberCountEl.textContent = admin ? memberCountEl.textContent : "-";
  }
  if (currentPage === "members" && admin === false) {
    currentPage = "dashboard";
  }
}

async function logoutCurrentUser() {
  try {
    await postJson("/auth/logout", {});
  } catch (error) {
    console.error("logout failed", error);
  }
  clearSession();
  loginStatusEl.textContent = "로그아웃되었습니다.";
}

async function submitDeleteAccount(passwordInputEl, statusTargetEl, formTargetEl) {
  const password = passwordInputEl ? passwordInputEl.value.trim() : "";

  if (currentUser === null || password === "") {
    if (statusTargetEl !== null) {
      statusTargetEl.textContent = "비밀번호를 입력하세요.";
    }
    return;
  }

  if (statusTargetEl !== null) {
    statusTargetEl.textContent = "회원탈퇴 처리 중...";
  }

  const { response, payload } = await deleteJson("/auth/delete", { password });

  if (response.ok === false) {
    if (statusTargetEl !== null) {
      statusTargetEl.textContent = payload.detail || "회원탈퇴에 실패했습니다.";
    }
    return;
  }

  if (formTargetEl !== null) {
    formTargetEl.reset();
  }
  if (deleteStatusEl !== null) {
    deleteStatusEl.textContent = "회원탈퇴가 완료되었습니다.";
  }
  if (deleteStatusMembersEl !== null) {
    deleteStatusMembersEl.textContent = "회원탈퇴가 완료되었습니다.";
  }
  clearSession();
  loginStatusEl.textContent = payload.username + " 계정이 삭제되었습니다.";
}

function openApp(user) {
  currentUser = user;
  window.localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(user));
  loginUserEl.textContent = (user.display_name || user.username) + " 님";
  loginScreenEl.hidden = true;
  appShellEl.hidden = false;
  deleteStatusEl.textContent = "";
  if (deleteStatusMembersEl !== null) {
    deleteStatusMembersEl.textContent = "";
  }
  if (changePasswordStatusEl !== null) {
    changePasswordStatusEl.textContent = "";
  }
  if (changePasswordStatusMembersEl !== null) {
    changePasswordStatusMembersEl.textContent = "";
  }
  applyRolePermissions();
  startAdminRefresh();
  showPage("dashboard", { history: "replace" });
  loadInitialData();
}

async function submitChangePassword(formTargetEl, currentPasswordInputEl, newPasswordInputEl, statusTargetEl) {
  const currentPassword = currentPasswordInputEl ? currentPasswordInputEl.value.trim() : "";
  const newPassword = newPasswordInputEl ? newPasswordInputEl.value.trim() : "";

  if (currentPassword === "" || newPassword === "") {
    if (statusTargetEl !== null) {
      statusTargetEl.textContent = "현재 비밀번호와 새 비밀번호를 모두 입력하세요.";
    }
    return;
  }

  if (statusTargetEl !== null) {
    statusTargetEl.textContent = "비밀번호 변경 중...";
  }

  const { response, payload } = await putJson("/auth/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });

  if (response.ok === false) {
    if (statusTargetEl !== null) {
      statusTargetEl.textContent = payload.detail || "비밀번호 변경에 실패했습니다.";
    }
    return;
  }

  if (formTargetEl !== null) {
    formTargetEl.reset();
  }
  if (statusTargetEl !== null) {
    statusTargetEl.textContent = "비밀번호가 변경되었습니다.";
  }
}

function showPage(page, options) {
  const historyMode = options && options.history ? options.history : "push";
  if (page === "members" && isAdmin() === false) {
    page = "dashboard";
  }
  currentPage = page;

  for (const button of navButtons) {
    button.classList.toggle("active", button.dataset.page === page);
  }

  for (const section of pageSections) {
    section.classList.toggle("active", section.id === "page-" + page);
  }

  pageTitleEl.textContent = pageMeta[page].title;
  pageDescriptionEl.textContent = pageMeta[page].description;

  if (STORAGE_KEYS.includes(page)) {
    renderStorageSubViews(page);
    renderStorageLogView(page);
    renderStoragePage(page);
  }

  syncHistoryState(historyMode);
}

async function loadInitialData() {
  await loadSites();
  await Promise.all([loadLogs(), loadRequestPosts(), loadBugPosts()]);
  if (isAdmin()) {
    await Promise.all([loadUsers(), loadActiveSessions(), loadDeletionRequests()]);
  } else {
    allUsers = [];
    allActiveSessions = [];
    allDeletionRequests = [];
    renderUserList();
    renderActiveSessions();
    renderDeletionRequests();
  }
  syncHistoryState("replace");
}

async function loadUsers() {
  if (isAdmin() === false) {
    allUsers = [];
    renderUserList();
    return;
  }
  const { payload: users } = await getJson("/users");
  allUsers = Array.isArray(users) ? users : [];
  renderUserList();
}

async function updateUserStatus(userId, isActive) {
  if (isAdmin() === false) {
    return;
  }
  const { response, payload } = await putJson("/admin/users/" + userId + "/status", { is_active: isActive });
  if (response.ok === false) {
    window.alert(payload.detail || "사용자 상태 변경에 실패했습니다.");
    return;
  }
  await Promise.all([loadUsers(), loadActiveSessions()]);
  if (currentUser !== null && currentUser.id === payload.id) {
    currentUser = payload;
    loginUserEl.textContent = getCurrentDisplayName() + " 님";
    applyRolePermissions();
  }
}

function renderUserList() {
  if (memberListEl === null || memberCountEl === null) {
    return;
  }

  memberCountEl.textContent = allUsers.length + "명";

  if (isAdmin() === false) {
    memberListEl.innerHTML = "<div class='empty'>관리자만 볼 수 있습니다.</div>";
    return;
  }

  if (allUsers.length === 0) {
    memberListEl.innerHTML = "<div class='empty'>등록된 회원이 없습니다.</div>";
    return;
  }

  memberListEl.innerHTML = allUsers.map((user) => {
    const displayName = user.display_name || user.full_name || user.username;
    const approvalPending = user.approval_pending === true;
    const stateLabel = approvalPending ? "승인 대기" : (user.is_active ? "사용중" : "비활성");
    const actionLabel = approvalPending ? "승인" : (user.is_active ? "비활성화" : "활성화");
    return "<article class='member-card'>" +
      "<div>" +
        "<strong>" + escapeHtml(displayName) + "</strong>" +
        "<p>" + escapeHtml(user.username) + " / " + escapeHtml(user.role || "user") + "</p>" +
      "</div>" +
      "<div class='request-actions'>" +
        "<span class='member-badge'>" + escapeHtml(stateLabel) + "</span>" +
        "<button class='secondary' data-action='toggle-user-status' data-user-id='" + user.id + "' data-next-active='" + String(user.is_active === false) + "' type='button'>" + escapeHtml(actionLabel) + "</button>" +
      "</div>" +
    "</article>";
  }).join("");
}

async function loadActiveSessions() {
  if (isAdmin() === false) {
    allActiveSessions = [];
    renderActiveSessions();
    return;
  }
  const { payload } = await getJson("/admin/sessions");
  allActiveSessions = Array.isArray(payload) ? payload : [];
  renderActiveSessions();
}

function renderActiveSessions() {
  if (activeSessionListEl === null) {
    return;
  }
  if (isAdmin() === false) {
    activeSessionListEl.innerHTML = "<div class='empty'>관리자만 볼 수 있습니다.</div>";
    return;
  }
  if (allActiveSessions.length === 0) {
    activeSessionListEl.innerHTML = "<div class='empty'>활성 세션이 없습니다.</div>";
    return;
  }
  activeSessionListEl.innerHTML = allActiveSessions.map((session) => {
    return "<article class='member-card'>" +
      "<div>" +
        "<strong>" + escapeHtml(session.display_name || session.username) + "</strong>" +
        "<p>" + escapeHtml(session.username) + " / 마지막 활동: " + escapeHtml(formatDate(session.last_seen_at)) + "</p>" +
        "<p>" + escapeHtml(session.ip_address || "-") + "</p>" +
      "</div>" +
      "<span class='member-badge'>" + escapeHtml(session.role || "user") + "</span>" +
    "</article>";
  }).join("");
}

async function loadDeletionRequests() {
  if (isAdmin() === false) {
    allDeletionRequests = [];
    renderDeletionRequests();
    return;
  }
  const { payload } = await getJson("/admin/deletion-requests");
  allDeletionRequests = Array.isArray(payload) ? payload : [];
  renderDeletionRequests();
}

async function reviewDeletionRequest(requestId, action) {
  if (isAdmin() === false) {
    return;
  }

  const { response, payload } = await putJson("/admin/deletion-requests/" + requestId + "/review", { action });
  if (response.ok === false) {
    window.alert(payload.detail || "삭제 요청 처리에 실패했습니다.");
    return;
  }
  await Promise.all([loadDeletionRequests(), loadLogs()]);
  statusEl.textContent = (payload.target_label || "선택한 로그") + " 삭제 요청이 처리되었습니다.";
}

function renderDeletionRequests() {
  if (deletionRequestListEl === null) {
    return;
  }
  if (isAdmin() === false) {
    deletionRequestListEl.innerHTML = "<div class='empty'>관리자만 볼 수 있습니다.</div>";
    return;
  }
  if (allDeletionRequests.length === 0) {
    deletionRequestListEl.innerHTML = "<div class='empty'>등록된 삭제 요청이 없습니다.</div>";
    return;
  }
  deletionRequestListEl.innerHTML = allDeletionRequests.map((item) => {
    const actions = item.status === "pending"
      ? "<div class='request-actions'>" +
          "<button data-action='approve-deletion-request' data-request-id='" + item.id + "' type='button'>허용</button>" +
          "<button class='secondary' data-action='reject-deletion-request' data-request-id='" + item.id + "' type='button'>거부</button>" +
        "</div>"
      : "";
    const reviewMeta = item.reviewed_by_name
      ? "<div class='request-meta'><span>처리자: " + escapeHtml(item.reviewed_by_name) + "</span><span>처리일: " + escapeHtml(formatDate(item.reviewed_at || item.executed_at)) + "</span></div>"
      : "";
    return "<article class='request-card'>" +
      "<div class='request-top'>" +
        "<div class='request-header'><span class='badge " + (item.status === "pending" ? "wait" : item.status === "executed" ? "done" : "doing") + "'>" + escapeHtml(item.status) + "</span></div>" +
        actions +
      "</div>" +
      "<h3 class='request-title'>" + escapeHtml(item.target_label || ("log #" + item.target_id)) + "</h3>" +
      "<p class='request-content'>" + escapeHtml(item.reason || "요청 사유 없음") + "</p>" +
      "<div class='request-meta'><span>요청자: " + escapeHtml(item.requester_name || "-") + "</span><span>요청일: " + escapeHtml(formatDate(item.created_at)) + "</span></div>" +
      reviewMeta +
    "</article>";
  }).join("");
}

function stopAdminRefresh() {
  if (adminRefreshTimerId !== null) {
    window.clearInterval(adminRefreshTimerId);
    adminRefreshTimerId = null;
  }
}

function startAdminRefresh() {
  stopAdminRefresh();
  if (isAdmin() === false) {
    return;
  }
  adminRefreshTimerId = window.setInterval(() => {
    if (appShellEl.hidden || isAdmin() === false) {
      return;
    }
    Promise.all([loadActiveSessions(), loadDeletionRequests()]).catch((error) => {
      console.error("admin refresh failed", error);
    });
  }, ADMIN_REFRESH_INTERVAL_MS);
}

async function loadSites() {
  const { payload } = await getJson("/sites");
  allSites = Array.isArray(payload) ? payload : [];
  renderSiteSections();
  syncUploadSiteOptions();
  syncHistoryState("replace");
}

async function loadLogs() {
  const { payload: logs } = await getJson("/logs");
  allLogs = Array.isArray(logs) ? logs : [];
  updateDashboard(allLogs);
  renderAllStoragePages();
  syncHistoryState("replace");
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
    const adminButtons = isAdmin()
      ? "<button class='secondary' data-action='site-edit' data-storage='" + storageKey + "' data-id='" + site.id + "' type='button'>수정</button>" +
        "<button class='danger' data-action='site-delete' data-storage='" + storageKey + "' data-id='" + site.id + "' type='button'>삭제</button>"
      : "";
    return "<article class='site-item" + activeClass + "'>" +
      "<div><strong>" + escapeHtml(site.name) + "</strong><p>" + escapeHtml(toStorageLabel(site.storage_name)) + "</p></div>" +
      "<div class='request-actions'>" +
        "<button data-action='open-site-logs' data-storage='" + storageKey + "' data-id='" + site.id + "' type='button'>로그 보기</button>" +
        adminButtons +
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
    renderRawEmptyState(storageKey, "로그를 선택하면 원본 내용이 여기에 표시됩니다.");
    renderSummaryEmptyState(storageKey, "summary를 선택하면 요약 내용이 여기에 표시됩니다.");
    toggleLogDetailPage(storageKey, "raw", false);
    toggleLogDetailPage(storageKey, "summary", false);
    return;
  }

  const logs = getStorageLogs(storageKey);
  const visibleLogs = getVisibleLogs(storageKey, logs);
  syncStorageLogControls(storageKey, logs.length, visibleLogs.length);

  if (logs.length === 0) {
    state.rawId = null;
    state.summaryId = null;
    view.rawListEl.innerHTML = "<div class='empty'>선택한 사이트에 업로드된 로그가 없습니다.</div>";
    view.summaryListEl.innerHTML = "<div class='empty'>선택한 사이트에 업로드된 summary가 없습니다.</div>";
    updateLogPagination(storageKey, "raw", 0, 0, 0);
    updateLogPagination(storageKey, "summary", 0, 0, 0);
    renderRawEmptyState(storageKey, "업로드된 원본 로그가 없습니다.");
    renderSummaryEmptyState(storageKey, "업로드된 summary가 없습니다.");
    toggleLogDetailPage(storageKey, "raw", false);
    toggleLogDetailPage(storageKey, "summary", false);
    return;
  }

  if (visibleLogs.length === 0) {
    state.rawId = null;
    state.summaryId = null;
    view.rawListEl.innerHTML = "<div class='empty'>검색 조건과 일치하는 원본 로그가 없습니다.</div>";
    view.summaryListEl.innerHTML = "<div class='empty'>검색 조건과 일치하는 summary가 없습니다.</div>";
    updateLogPagination(storageKey, "raw", 0, 0, 0);
    updateLogPagination(storageKey, "summary", 0, 0, 0);
    renderRawEmptyState(storageKey, "검색 조건을 바꾸면 원본 로그를 다시 볼 수 있습니다.");
    renderSummaryEmptyState(storageKey, "검색 조건을 바꾸면 summary를 다시 볼 수 있습니다.");
    toggleLogDetailPage(storageKey, "raw", false);
    toggleLogDetailPage(storageKey, "summary", false);
    return;
  }

  const availableIds = visibleLogs.map((log) => log.id);
  if (availableIds.includes(state.rawId) === false) {
    state.rawId = null;
  }
  if (availableIds.includes(state.summaryId) === false) {
    state.summaryId = null;
  }

  renderLogListPage(storageKey, "raw", visibleLogs, state.rawId);
  renderLogListPage(storageKey, "summary", visibleLogs, state.summaryId);

  if (state.rawId !== null) {
    loadRawLog(storageKey, state.rawId);
  } else {
    renderRawEmptyState(storageKey, "왼쪽 목록에서 원본 로그를 선택하세요.");
    toggleLogDetailPage(storageKey, "raw", false);
  }

  if (state.summaryId !== null) {
    loadSummary(storageKey, state.summaryId);
  } else {
    renderSummaryEmptyState(storageKey, "왼쪽 목록에서 summary를 선택하세요.");
    toggleLogDetailPage(storageKey, "summary", false);
  }
}

function getStorageLogs(storageKey) {
  return allLogs.filter((log) => {
    return log.storage_name === storageKey && log.site_id === storageState[storageKey].activeSiteId;
  });
}

function getVisibleLogs(storageKey, logs) {
  const state = storageState[storageKey];
  const query = state.logSearchQuery.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    if (query === "") {
      return true;
    }
    const haystack = [log.filename, log.site_name, log.storage_name]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  filteredLogs.sort((left, right) => {
    if (state.logSortMode === "oldest") {
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    }
    if (state.logSortMode === "name-asc") {
      return left.filename.localeCompare(right.filename, "ko");
    }
    if (state.logSortMode === "name-desc") {
      return right.filename.localeCompare(left.filename, "ko");
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  return filteredLogs;
}

function syncStorageLogControls(storageKey, totalCount, filteredCount) {
  const state = storageState[storageKey];
  const view = storageViews[storageKey];
  const resultText = filteredCount === totalCount ? "총 " + filteredCount + "건" : "총 " + totalCount + "건 중 " + filteredCount + "건";
  const controls = [
    [view.rawSearchEl, state.logSearchQuery],
    [view.summarySearchEl, state.logSearchQuery],
    [view.rawSortEl, state.logSortMode],
    [view.summarySortEl, state.logSortMode],
    [view.rawPageSizeEl, String(state.pageSize)],
    [view.summaryPageSizeEl, String(state.pageSize)],
    [view.rawCountEl, resultText],
    [view.summaryCountEl, resultText],
  ];

  for (const [element, value] of controls) {
    if (element === null) {
      continue;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      element.value = value;
      continue;
    }
    element.textContent = value;
  }
}

function updateLogPagination(storageKey, type, totalCount, page, pageCount) {
  const view = storageViews[storageKey];
  const container = type === "raw" ? view.rawListEl : view.summaryListEl;
  const statusEl = type === "raw" ? view.rawPageStatusEl : view.summaryPageStatusEl;
  const prevButton = document.querySelector('[data-action="log-page-prev"][data-storage="' + storageKey + '"][data-log-type="' + type + '"]');
  const nextButton = document.querySelector('[data-action="log-page-next"][data-storage="' + storageKey + '"][data-log-type="' + type + '"]');

  if (statusEl !== null) {
    statusEl.textContent = totalCount === 0 ? "0 / 0" : page + " / " + pageCount;
  }
  if (prevButton !== null) {
    prevButton.disabled = page <= 1;
  }
  if (nextButton !== null) {
    nextButton.disabled = pageCount === 0 || page >= pageCount;
  }
  if (container !== null && totalCount === 0) {
    container.innerHTML = "<div class='empty'>표시할 로그가 없습니다.</div>";
  }
}

function renderLogListPage(storageKey, type, logs, activeId) {
  const view = storageViews[storageKey];
  const state = storageState[storageKey];
  const container = type === "raw" ? view.rawListEl : view.summaryListEl;
  const action = type === "raw" ? "open-raw-log" : "open-summary-log";
  const pageKey = type === "raw" ? "rawPage" : "summaryPage";
  const pageSize = state.pageSize;
  const pageCount = Math.max(1, Math.ceil(logs.length / pageSize));
  state[pageKey] = Math.min(Math.max(1, state[pageKey]), pageCount);
  const page = state[pageKey];
  const startIndex = (page - 1) * pageSize;
  const pageLogs = logs.slice(startIndex, startIndex + pageSize);

  updateLogPagination(storageKey, type, logs.length, page, pageCount);

  container.innerHTML = pageLogs.map((log) => {
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
  const isDesktop = isDesktopLogSplitView();
  if (listPageEl !== null) {
    listPageEl.hidden = showDetail && isDesktop === false;
  }
  if (detailPageEl !== null) {
    detailPageEl.hidden = !showDetail && isDesktop === false;
  }
}

function setDetailEmptyState(detailPageEl, empty) {
  if (detailPageEl !== null) {
    detailPageEl.classList.toggle("is-empty", empty);
  }
}

function renderRawEmptyState(storageKey, message) {
  const view = storageViews[storageKey];
  setDetailEmptyState(view.rawDetailPageEl, true);
  view.rawNameEl.textContent = "원본 로그 미리보기";
  view.rawMetaEl.textContent = message;
  view.rawContentEl.textContent = "";
}

function renderSummaryEmptyState(storageKey, message) {
  const view = storageViews[storageKey];
  const state = storageState[storageKey];
  setDetailEmptyState(view.summaryDetailPageEl, true);
  view.summaryNameEl.textContent = "요약 로그 미리보기";
  view.summaryMetaEl.textContent = message;
  view.summaryGridEl.innerHTML = "<div class='summary-field summary-field-empty'><strong>summary</strong><span>" + escapeHtml(message) + "</span></div>";
  view.summaryRawEl.textContent = "";
  state.currentSummarySections = {};
  state.currentSpecialNotes = [];
  state.activeSummarySection = "overview";
  renderSummarySectionView(storageKey);
}

async function loadRawLog(storageKey, logId) {
  const view = storageViews[storageKey];
  const response = await fetch("/logs/" + logId + "/raw");
  const payload = await response.json();

  if (response.ok === false) {
    renderRawEmptyState(storageKey, payload.detail || "원본 로그를 불러오지 못했습니다.");
    toggleLogDetailPage(storageKey, "raw", false);
    view.rawListEl.innerHTML = "<div class='empty'>" + escapeHtml(payload.detail || "원본 로그를 불러오지 못했습니다.") + "</div>";
    return;
  }

  setDetailEmptyState(view.rawDetailPageEl, false);
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
    renderSummaryEmptyState(storageKey, payload.detail || "summary를 불러오지 못했습니다.");
    toggleLogDetailPage(storageKey, "summary", false);
    view.summaryListEl.innerHTML = "<div class='empty'>" + escapeHtml(payload.detail || "summary를 불러오지 못했습니다.") + "</div>";
    return;
  }

  setDetailEmptyState(view.summaryDetailPageEl, false);
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
    return "<div class='summary-field'><strong>" + escapeHtml(key) + "</strong><span>" + formatSummaryOverviewValue(key, safeValue) + "</span></div>";
  }).join("");
}

function formatSummaryOverviewValue(key, value) {
  let formatted = value;

  if (key === "Serial number") {
    formatted = formatted.replace(/\s*,\s*/g, "\n");
  }

  if (key === "SP IP/SP Version") {
    formatted = formatted.replace(/\s*,\s*/g, "\n");
    formatted = formatted.replace(/\s*\/\s*/g, "/");
  }

  if (key === "maxraidsize, diskcount") {
    formatted = formatted.replace(/\s*,\s*/g, "\n");
    formatted = formatted.replace(/\s*:\s*/g, ": ");
  }

  if (key === "현재 장착 중인 확장 슬롯" || key === "현재 장착중인 확장 슬롯") {
    formatted = formatted
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s*,\s*(?=slot\s*\d+\s*:)/gi, "\n")
      .replace(/\s*(slot\s*\d+\s*:)\s*/gi, (match, slotLabel, offset) => {
        const normalizedLabel = slotLabel.replace(/\s+/g, " ").trim();
        if (offset === 0) {
          return normalizedLabel;
        }
        return "\n" + normalizedLabel;
      })
      .trim();
  }

  return escapeHtml(formatted).replace(/\n/g, "<br>");
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
  const siteUrl = isEdit ? "/sites/" + editId : "/sites";
  const siteCall = isEdit ? putJson : postJson;
  const { response, payload } = await siteCall(siteUrl, { storage_name: storageKey, name: siteName });

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

  const { response, payload } = await deleteJson("/sites/" + siteId);

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

async function requestSelectedLogDeletion(logId) {
  if (logId === null || Number.isNaN(logId)) {
    return;
  }

  const reason = window.prompt("삭제 요청 사유를 입력하세요.", "");
  if (reason === null) {
    return;
  }

  statusEl.textContent = "삭제 요청 등록 중...";
  const { response, payload } = await postJson("/logs/" + logId + "/deletion-requests", { reason });

  if (response.ok === false) {
    statusEl.textContent = payload.detail || "삭제 요청 등록에 실패했습니다.";
    return;
  }

  statusEl.textContent = (payload.target_label || "선택한 로그") + " 삭제 요청이 등록되었습니다.";
  if (isAdmin()) {
    await loadDeletionRequests();
  }
}

async function loadRequestPosts() {
  const { payload } = await getJson("/requests");
  allRequestPosts = Array.isArray(payload) ? payload : [];
  renderFilteredRequestPosts();
}

async function loadBugPosts() {
  const { payload } = await getJson("/bugs");
  allBugPosts = Array.isArray(payload) ? payload : [];
  renderFilteredBugPosts();
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
  if (requestCountEl !== null) {
    requestCountEl.textContent = posts.length + "건";
  }
  if (posts.length === 0) {
    requestListEl.innerHTML = "<div class='empty'>등록된 수정 요청이 없습니다.</div>";
    return;
  }

  const canManage = isAuthenticated();
  requestListEl.innerHTML = posts.map((post) => {
    const actions = canManage
      ? "<div class='request-actions'>" +
          "<button class='secondary' data-action='request-edit' data-id='" + post.id + "' type='button'>수정</button>" +
          "<button class='danger' data-action='request-delete' data-id='" + post.id + "' type='button'>삭제</button>" +
        "</div>"
      : "";
    return "<article class='request-card'>" +
      "<div class='request-top'>" +
        "<div class='request-header'><span class='badge " + getStatusBadgeClass(post.status) + "'>" + escapeHtml(post.status) + "</span></div>" +
        actions +
      "</div>" +
      "<h3 class='request-title'>" + escapeHtml(post.title) + "</h3>" +
      "<p class='request-content'>" + escapeHtml(post.content) + "</p>" +
      "<div class='request-meta'><span>작성자: " + escapeHtml(post.author || "-") + "</span><span>업데이트: " + escapeHtml(formatDate(post.updated_at || post.created_at)) + "</span></div>" +
    "</article>";
  }).join("");
}

function renderFilteredBugPosts() {
  const keyword = bugSearchEl && typeof bugSearchEl.value === "string" ? bugSearchEl.value.trim().toLowerCase() : "";
  const filteredPosts = allBugPosts.filter((post) => {
    if (keyword === "") {
      return true;
    }
    const haystack = [post.title, post.content, post.author]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });
  renderBugPosts(filteredPosts);
}

function renderBugPosts(posts) {
  if (bugListEl === null) {
    return;
  }

  if (bugCountEl !== null) {
    bugCountEl.textContent = posts.length + "건";
  }

  if (posts.length === 0) {
    bugListEl.innerHTML = "<div class='empty'>등록된 버그가 없습니다.</div>";
    return;
  }

  const canManage = isAuthenticated();
  bugListEl.innerHTML = posts.map((post) => {
    const actions = canManage
      ? "<div class='request-actions'>" +
          "<button class='secondary' data-action='bug-edit' data-id='" + post.id + "' type='button'>수정</button>" +
          "<button class='danger' data-action='bug-delete' data-id='" + post.id + "' type='button'>삭제</button>" +
        "</div>"
      : "";
    return "<article class='request-card'>" +
      "<div class='request-top'>" +
        "<div class='request-header'><span class='badge doing'>버그</span></div>" +
        actions +
      "</div>" +
      "<h3 class='request-title'>" + escapeHtml(post.title) + "</h3>" +
      "<p class='request-content'>" + escapeHtml(post.content) + "</p>" +
      "<div class='request-meta'><span>작성자: " + escapeHtml(post.author || "-") + "</span><span>업데이트: " + escapeHtml(formatDate(post.updated_at || post.created_at)) + "</span></div>" +
    "</article>";
  }).join("");
}

function populateRequestForm(postId) {
  getJson("/requests")
    .then(({ payload: posts }) => {
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

  const { response, payload } = await deleteJson("/requests/" + postId);

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

  const { response, payload } = await deleteJson("/bugs/" + postId);

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

function getHistoryStateSnapshot() {
  return getHistoryStateSnapshotModule(currentPage, STORAGE_KEYS, storageState);
}

function syncHistoryState(mode) {
  lastHistorySnapshot = syncHistoryStateModule({
    appHidden: appShellEl.hidden,
    isApplyingHistoryState,
    mode,
    lastHistorySnapshot,
    currentPage,
    storageKeys: STORAGE_KEYS,
    storageState,
  });
}

function applyHistoryState(state) {
  isApplyingHistoryState = true;
  const applied = applyHistoryStateModule(state, {
    pageMeta,
    storageKeys: STORAGE_KEYS,
    storageState,
    showPage,
    renderAllStoragePages,
  });
  if (applied === null) {
    isApplyingHistoryState = false;
    return;
  }
  currentPage = applied.currentPage;
  isApplyingHistoryState = false;
  lastHistorySnapshot = applied.snapshot;
}

window.addEventListener("popstate", (event) => {
  applyHistoryState(event.state);
});

window.addEventListener("resize", () => {
  const isDesktop = isDesktopLogSplitView();
  if (isDesktop === lastLogLayoutMode) {
    return;
  }
  lastLogLayoutMode = isDesktop;
  renderAllStoragePages();
});

async function restoreSession() {
  const savedUserJson = window.localStorage.getItem(SESSION_USER_STORAGE_KEY);
  if (savedUserJson) {
    try {
      const savedUser = JSON.parse(savedUserJson);
      if (savedUser && typeof savedUser === "object") {
        currentUser = savedUser;
        loginUserEl.textContent = getCurrentDisplayName() + " 님";
        loginScreenEl.hidden = true;
        appShellEl.hidden = false;
        applyRolePermissions();
      }
    } catch (error) {
      window.localStorage.removeItem(SESSION_USER_STORAGE_KEY);
    }
  }
  try {
    const response = await fetch("/auth/me", { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json();
    if (response.ok === false || payload.authenticated !== true || payload.user === null) {
      clearSession();
      return;
    }
    openApp(payload.user);
  } catch (error) {
    if (savedUserJson) {
      loginStatusEl.textContent = "세션 확인이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
      return;
    }
    clearSession();
    loginStatusEl.textContent = "서버에 연결할 수 없어 다시 로그인해 주세요.";
  }
}

restoreSession();
