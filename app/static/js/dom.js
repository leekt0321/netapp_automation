function getStorageElement(storageKey, role) {
  return document.querySelector('[data-storage="' + storageKey + '"][data-role="' + role + '"]');
}

export const loginScreenEl = document.getElementById("login-screen");
export const appShellEl = document.getElementById("app-shell");
export const loginFormEl = document.getElementById("login-form");
export const loginIdEl = document.getElementById("login-id");
export const loginPasswordEl = document.getElementById("login-password");
export const loginStatusEl = document.getElementById("login-status");
export const registerFormEl = document.getElementById("register-form");
export const registerNameEl = document.getElementById("register-name");
export const registerIdEl = document.getElementById("register-id");
export const registerPasswordEl = document.getElementById("register-password");
export const registerStatusEl = document.getElementById("register-status");
export const loginUserEl = document.getElementById("login-user");
export const logoutButtonEl = document.getElementById("logout-button");
export const deleteFormEl = document.getElementById("delete-form");
export const deletePasswordEl = document.getElementById("delete-password");
export const deleteStatusEl = document.getElementById("delete-status");
export const deleteFormMembersEl = document.getElementById("delete-form-members");
export const deletePasswordMembersEl = document.getElementById("delete-password-members");
export const deleteStatusMembersEl = document.getElementById("delete-status-members");
export const changePasswordFormEl = document.getElementById("change-password-form");
export const currentPasswordEl = document.getElementById("current-password");
export const newPasswordEl = document.getElementById("new-password");
export const changePasswordStatusEl = document.getElementById("change-password-status");
export const changePasswordFormMembersEl = document.getElementById("change-password-form-members");
export const currentPasswordMembersEl = document.getElementById("current-password-members");
export const newPasswordMembersEl = document.getElementById("new-password-members");
export const changePasswordStatusMembersEl = document.getElementById("change-password-status-members");
export const memberCountEl = document.getElementById("member-count");
export const memberListEl = document.getElementById("member-list");
export const activeSessionListEl = document.getElementById("active-session-list");
export const deletionRequestListEl = document.getElementById("deletion-request-list");
export const navButtons = Array.from(document.querySelectorAll(".nav-button"));
export const pageSections = Array.from(document.querySelectorAll(".page-section"));
export const pageTitleEl = document.getElementById("page-title");
export const pageDescriptionEl = document.getElementById("page-description");
export const uploadFormEl = document.getElementById("upload-form");
export const fileInputEl = document.getElementById("file");
export const storageNameEl = document.getElementById("storage-name");
export const siteIdEl = document.getElementById("site-id");
export const uploadFileListEl = document.getElementById("upload-file-list");
export const statusEl = document.getElementById("status");
export const totalLogCountEl = document.getElementById("total-log-count");
export const latestLogNameEl = document.getElementById("latest-log-name");
export const openUploadManualFieldsButtonEl = document.getElementById("open-upload-manual-fields");
export const manualFieldsModalEl = document.getElementById("manual-fields-modal");
export const manualFieldsTitleEl = document.getElementById("manual-fields-title");
export const manualFieldsFormEl = document.getElementById("manual-fields-form");
export const manualFieldsCloseEl = document.getElementById("manual-fields-close");
export const manualFieldsResetEl = document.getElementById("manual-fields-reset");
export const manualFieldsStatusEl = document.getElementById("manual-fields-status");
export const requestFormEl = document.getElementById("request-form");
export const requestEditIdEl = document.getElementById("request-edit-id");
export const requestStatusEl = document.getElementById("request-status");
export const requestTitleEl = document.getElementById("request-title");
export const requestContentEl = document.getElementById("request-content");
export const requestStatusMessageEl = document.getElementById("request-status-message");
export const requestListEl = document.getElementById("request-list");
export const requestSubmitButtonEl = document.getElementById("request-submit-button");
export const requestCancelButtonEl = document.getElementById("request-cancel-button");
export const requestSearchEl = document.getElementById("request-search");
export const requestFilterButtons = Array.from(document.querySelectorAll("[data-request-filter]"));
export const bugFormEl = document.getElementById("bug-form");
export const bugEditIdEl = document.getElementById("bug-edit-id");
export const bugTitleEl = document.getElementById("bug-title");
export const bugContentEl = document.getElementById("bug-content");
export const bugStatusMessageEl = document.getElementById("bug-status-message");
export const bugListEl = document.getElementById("bug-list");
export const bugSubmitButtonEl = document.getElementById("bug-submit-button");
export const bugCancelButtonEl = document.getElementById("bug-cancel-button");

export function createStorageViews(storageKeys) {
  const storageViews = {};
  for (const storageKey of storageKeys) {
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
  }
  return storageViews;
}
