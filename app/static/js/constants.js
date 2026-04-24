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
    title: "대시보드",
    description: "업로드 현황을 확인하고 새 로그 파일을 등록합니다.",
  },
  storage1: {
    title: "스토리지1팀",
    description: "스토리지1팀 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  storage2: {
    title: "스토리지2팀",
    description: "스토리지2팀 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  storage3: {
    title: "스토리지3팀",
    description: "스토리지3팀 사이트별 원본 로그와 요약 로그를 확인합니다.",
  },
  members: {
    title: "회원 관리",
    description: "가입 승인, 계정 상태 변경, 삭제 요청 검토를 진행합니다.",
  },
  bugs: {
    title: "버그 기록",
    description: "운영 중 발견한 버그를 기록하고 업데이트합니다.",
  },
  requests: {
    title: "수정 요청 게시판",
    description: "수정 요청을 등록하고 진행 상태를 추적합니다.",
  },
};
