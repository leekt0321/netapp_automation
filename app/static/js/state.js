export function createStorageState(storageKeys, createEmptyManualFields) {
  const storageState = {};
  for (const storageKey of storageKeys) {
    storageState[storageKey] = {
      rawId: null,
      summaryId: null,
      activeSiteId: null,
      activeView: "sites",
      activeLogView: "raw",
      logSearchQuery: "",
      logSortMode: "newest",
      pageSize: 10,
      rawPage: 1,
      summaryPage: 1,
      activeSummarySection: "overview",
      activeEventLogFilter: "all",
      currentSummarySections: {},
      currentSpecialNotes: [],
      specialNoteDraft: "",
      specialNoteSourceId: "",
      currentManualFields: createEmptyManualFields(),
    };
  }
  return storageState;
}

export function createAppState(createEmptyManualFields, isDesktopLogSplitView) {
  return {
    allLogs: [],
    allSites: [],
    allRequestPosts: [],
    allBugPosts: [],
    allUsers: [],
    allActiveSessions: [],
    allDeletionRequests: [],
    activeRequestFilter: "all",
    uploadManualFields: createEmptyManualFields(),
    manualFieldsModalMode: "upload",
    manualFieldsModalTarget: { storageKey: null, logId: null },
    currentPage: "dashboard",
    isApplyingHistoryState: false,
    lastHistorySnapshot: "",
    lastLogLayoutMode: isDesktopLogSplitView(),
    currentUser: null,
    adminRefreshTimerId: null,
  };
}
