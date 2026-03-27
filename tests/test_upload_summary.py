import asyncio
import importlib
import sys
from pathlib import Path

from fastapi.responses import FileResponse, HTMLResponse


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


SAMPLE_LOG = """FAS2750::*> node show
NetApp Release 9.17.1P2: Fri Nov  7 04:39:01 EST 2025
slot 0: System Board 1.5 GHz (System Board XXII C2)
                Model Name:         FAS2750
System Serial Number: 952047001063 (FAS2750-01)
System Serial Number: 952047000902 (FAS2750-02)
00.2 : NETAPP   X422_HCOBE600A10 NA02 560.0GB 520B/sect (DISK001)
00.3 : NETAPP   X422_HCOBE600A10 NA02 560.0GB 520B/sect (DISK002)
"""

SAMPLE_12_NODE_LOG = """cloudv4::*> system controller show
Controller Name System ID Serial Number Model Status

PC2HDD001-01 538261227 952237000136 FAS8300 ok
PC2HDD001-02 538261030 952236001752 FAS8300 ok
PC2HDD002-01 538206132 952117001954 FAS8300 ok
PC2HDD002-02 538260892 952237000367 FAS8300 ok
PC2HDD003-01 538260971 952237000296 FAS8300 ok
PC2HDD003-02 538261160 952237000232 FAS8300 ok
PC2SSD001-01 538260683 952236001391 AFF-A400 ok
PC2SSD001-02 538250337 952220001641 AFF-A400 ok
PC2SSD002-01 538260649 952237000569 AFF-A400 ok
PC2SSD002-02 538261172 952237000181 AFF-A400 ok
PC2SSD003-01 538260819 952237000437 AFF-A400 ok
PC2SSD003-02 538311486 952344003865 AFF-A400 ok
12 entries were displayed.
"""


class DummyUploadFile:
    def __init__(self, filename: str, content: bytes, content_type: str = "text/plain"):
        self.filename = filename
        self._content = content
        self.content_type = content_type

    async def read(self) -> bytes:
        return self._content


def load_app(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "upload"))
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "secret123")
    monkeypatch.setenv("ADMIN_FULL_NAME", "Baobab Admin")

    for module_name in ("app.main", "app.models", "app.db", "app.config", "app.auth"):
        sys.modules.pop(module_name, None)

    return importlib.import_module("app.main")


def create_uploaded_log(main_module, filename: str = "fas2750.log", content: str = SAMPLE_LOG, save_name: str = "fas2750.log"):
    db_generator = main_module.get_db()
    db = next(db_generator)
    upload_file = DummyUploadFile(filename, content.encode("utf-8"))

    try:
        payload = asyncio.run(
            main_module.upload_log(file=upload_file, save_name=save_name, db=db)
        )
    finally:
        db_generator.close()

    return payload


def create_uploaded_logs(main_module, save_names=None):
    db_generator = main_module.get_db()
    db = next(db_generator)
    upload_files = [
        DummyUploadFile("fas2750.log", SAMPLE_LOG.encode("utf-8")),
        DummyUploadFile("cloudv4.log", SAMPLE_12_NODE_LOG.encode("utf-8")),
    ]

    try:
        payload = asyncio.run(
            main_module.upload_logs(files=upload_files, save_name="", save_names=save_names, db=db)
        )
    finally:
        db_generator.close()

    return payload


def test_root_serves_html_ui(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)

    response = main_module.root()
    body = response.body.decode("utf-8")

    assert isinstance(response, HTMLResponse)
    assert "다운로드" in body
    assert "삭제" in body
    assert "multiple" in body
    assert "upload-file-list" in body


def test_startup_creates_admin_user(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)
    main_module.on_startup()

    db_generator = main_module.get_db()
    db = next(db_generator)
    try:
        user = db.query(main_module.User).filter(main_module.User.username == "admin").first()
    finally:
        db_generator.close()

    assert user is not None
    assert user.full_name == "Baobab Admin"
    assert user.is_active is True


def test_register_login_and_delete_user(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)
    main_module.on_startup()

    db_generator = main_module.get_db()
    db = next(db_generator)
    try:
        register_payload = main_module.register_user(
            main_module.RegisterPayload(username="user1", password="pw1234", full_name="User One"),
            db=db,
        )
        login_payload = main_module.login(
            main_module.LoginPayload(username="user1", password="pw1234"),
            db=db,
        )
        delete_payload = main_module.delete_user(
            main_module.DeleteUserPayload(username="user1", password="pw1234"),
            db=db,
        )
        deleted_user = db.query(main_module.User).filter(main_module.User.username == "user1").first()
    finally:
        db_generator.close()

    assert register_payload["username"] == "user1"
    assert login_payload["full_name"] == "User One"
    assert delete_payload["deleted"] is True
    assert deleted_user is None


def test_upload_creates_original_and_summary_files(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)
    main_module.on_startup()

    payload = create_uploaded_log(main_module)

    original_path = Path(payload["stored_path"])
    summary_path = Path(payload["summary_stored_path"])

    assert original_path.exists()
    assert original_path.read_bytes() == SAMPLE_LOG.encode("utf-8")
    assert summary_path.exists()
    assert payload["summary_filename"] == "fas2750_summary.txt"


def test_upload_multiple_files(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)
    main_module.on_startup()

    payload = create_uploaded_logs(main_module, save_names=["fas2750_custom.log", "cloudv4_custom.log"])

    assert payload["count"] == 2
    assert [item["filename"] for item in payload["items"]] == ["fas2750_custom.log", "cloudv4_custom.log"]
    assert payload["items"][1]["summary"]["model_name"] == "FAS8300,AFF-A400"
    assert payload["latest"]["filename"] == "cloudv4_custom.log"


def test_parse_12_node_cluster_model_and_serials(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)

    summary = main_module.parse_netapp_log(SAMPLE_12_NODE_LOG)

    assert summary["cluster_name"] == "cloudv4"
    assert summary["model_name"] == "FAS8300,AFF-A400"
    assert summary["controller_serial"] == ",".join(
        [
            "952237000136",
            "952236001752",
            "952117001954",
            "952237000367",
            "952237000296",
            "952237000232",
            "952236001391",
            "952220001641",
            "952237000569",
            "952237000181",
            "952237000437",
            "952344003865",
        ]
    )


def test_download_and_delete_log(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)
    main_module.on_startup()

    upload_payload = create_uploaded_log(main_module)
    original_path = Path(upload_payload["stored_path"])
    summary_path = Path(upload_payload["summary_stored_path"])

    db_generator = main_module.get_db()
    db = next(db_generator)
    try:
        download_response = main_module.download_log(upload_payload["id"], db=db)
        delete_response = main_module.delete_log(upload_payload["id"], db=db)
        deleted_log = db.query(main_module.UploadedLog).filter(main_module.UploadedLog.id == upload_payload["id"]).first()
    finally:
        db_generator.close()

    assert isinstance(download_response, FileResponse)
    assert str(download_response.path) == str(original_path)
    assert delete_response["deleted"] is True
    assert deleted_log is None
    assert not original_path.exists()
    assert not summary_path.exists()


def test_get_raw_and_summary_payload(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)
    main_module.on_startup()

    upload_payload = create_uploaded_log(main_module)

    db_generator = main_module.get_db()
    db = next(db_generator)
    try:
        raw_payload = main_module.get_raw_log(upload_payload["id"], db=db)
        summary_payload = main_module.get_log_summary(upload_payload["id"], db=db)
    finally:
        db_generator.close()

    assert raw_payload["filename"] == "fas2750.log"
    assert "NetApp Release 9.17.1P2" in raw_payload["raw_text"]
    assert summary_payload["summary_filename"] == "fas2750_summary.txt"
    assert summary_payload["summary"]["cluster_name"] == "FAS2750"
