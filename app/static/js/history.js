export function getHistoryStateSnapshot(currentPage, storageKeys, storageState) {
  const state = { view: "app", page: currentPage };
  if (storageKeys.includes(currentPage)) {
    const storage = storageState[currentPage];
    state.storage = {
      activeSiteId: storage.activeSiteId,
      activeView: storage.activeView,
      activeLogView: storage.activeLogView,
      rawId: storage.rawId,
      summaryId: storage.summaryId,
      activeSummarySection: storage.activeSummarySection,
      activeEventLogFilter: storage.activeEventLogFilter,
    };
  }
  return state;
}

export function syncHistoryState(options) {
  const {
    appHidden,
    isApplyingHistoryState,
    mode,
    lastHistorySnapshot,
    currentPage,
    storageKeys,
    storageState,
  } = options;

  if (appHidden || isApplyingHistoryState) {
    return lastHistorySnapshot;
  }

  const historyMode = mode || "push";
  if (historyMode === "skip") {
    return lastHistorySnapshot;
  }

  const state = getHistoryStateSnapshot(currentPage, storageKeys, storageState);
  const snapshot = JSON.stringify(state);
  if (historyMode === "push" && snapshot === lastHistorySnapshot) {
    return lastHistorySnapshot;
  }

  if (historyMode === "replace") {
    window.history.replaceState(state, "", window.location.pathname);
  } else {
    window.history.pushState(state, "", window.location.pathname);
  }
  return snapshot;
}

export function applyHistoryState(state, options) {
  const { pageMeta, storageKeys, storageState, showPage, renderAllStoragePages } = options;

  if (!state || state.view !== "app") {
    return null;
  }

  const nextPage = pageMeta[state.page] ? state.page : "dashboard";

  if (storageKeys.includes(nextPage) && state.storage) {
    const storage = storageState[nextPage];
    storage.activeSiteId = state.storage.activeSiteId === null ? null : Number(state.storage.activeSiteId);
    storage.activeView = state.storage.activeView === "logs" ? "logs" : "sites";
    storage.activeLogView = state.storage.activeLogView === "summary" ? "summary" : "raw";
    storage.rawId = state.storage.rawId === null ? null : Number(state.storage.rawId);
    storage.summaryId = state.storage.summaryId === null ? null : Number(state.storage.summaryId);
    storage.activeSummarySection = state.storage.activeSummarySection || "overview";
    storage.activeEventLogFilter = state.storage.activeEventLogFilter || "all";
  }

  showPage(nextPage, { history: "skip" });
  renderAllStoragePages();
  return {
    currentPage: nextPage,
    snapshot: JSON.stringify(getHistoryStateSnapshot(nextPage, storageKeys, storageState)),
  };
}
