export const STORAGE_KEYS = ["storage1", "storage2", "storage3"];

export const MANUAL_FIELD_KEYS = [
  "install_date",
  "warranty",
  "maintenance",
  "office_name",
  "install_rack",
  "service",
  "manager_contact",
  "id_password",
  "asup",
  "aggr_diskcount_override",
];

export const DESKTOP_LOG_MEDIA_QUERY = "(min-width: 1181px)";
export const SESSION_USER_STORAGE_KEY = "baobab.currentUser";
export const ADMIN_REFRESH_INTERVAL_MS = 10000;
export const ALLOWED_UPLOAD_EXTENSIONS = [".log", ".txt"];

export const pageMeta = {
  dashboard: {
    title: "Dashboard",
    description: "업로드 파일 수와 최근 업로드 파일을 확인합니다.",
  },
  storage1: {
    title: "스토리지1팀",
    description: "스토리지1팀 내부 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  storage2: {
    title: "스토리지2팀",
    description: "스토리지2팀 내부 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  storage3: {
    title: "스토리지3팀",
    description: "스토리지3팀 내부 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  members: {
    title: "회원 관리 목록",
    description: "회원가입된 계정 정보를 확인하고 내 계정을 관리합니다.",
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
