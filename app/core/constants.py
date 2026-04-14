from uuid import uuid4


SERVER_SESSION_ID = str(uuid4())
STORAGE_CHOICES = {"storage1", "storage2", "storage3"}
REQUEST_STATUS_CHOICES = {"대기", "진행중", "완료"}
AUTH_COOKIE_NAME = "baobab_session"
USER_ROLE_ADMIN = "admin"
USER_ROLE_USER = "user"
USER_ROLE_CHOICES = {USER_ROLE_ADMIN, USER_ROLE_USER}
DELETION_REQUEST_STATUS_PENDING = "pending"
DELETION_REQUEST_STATUS_REJECTED = "rejected"
DELETION_REQUEST_STATUS_EXECUTED = "executed"
DELETION_REQUEST_STATUS_CHOICES = {
    DELETION_REQUEST_STATUS_PENDING,
    DELETION_REQUEST_STATUS_REJECTED,
    DELETION_REQUEST_STATUS_EXECUTED,
}
MANUAL_FIELD_DEFINITIONS = (
    ("install_date", "설치 날짜"),
    ("warranty", "워런티"),
    ("maintenance", "유지보수"),
    ("office_name", "국사명"),
    ("install_rack", "설치 상면"),
    ("service", "서비스"),
    ("manager_contact", "담당자(연락처)"),
    ("id_password", "ID/PW"),
    ("asup", "ASUP"),
    ("aggr_diskcount_override", "maxraidsize, diskcount"),
)
SUMMARY_DISPLAY_LABELS = {
    "vendor": "vendor",
    "hostname": "hostname",
    "model_name": "model",
    "controller_serial": "Serial number",
    "ontap_version": "OS Version",
    "sp_ip_version": "SP IP/SP Version",
    "mgmt": "mgmt",
    "shelf_count": "Shelf 개수",
    "used_protocols": "사용 프로토콜",
    "snapmirror_in_use": "snapmirror 사용 유무",
    "expansion_slots": "현재 장착 중인 확장 슬롯",
    "aggr_diskcount_maxraidsize": "maxraidsize, diskcount",
    "volume_count": "볼륨 개수",
    "lun_count": "lun 개수",
}
