import asyncio
import importlib
import sys
from pathlib import Path

from fastapi.responses import HTMLResponse


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

    for module_name in ("app.main", "app.models", "app.db", "app.config"):
        sys.modules.pop(module_name, None)

    return importlib.import_module("app.main")


def create_uploaded_log(main_module):
    db_generator = main_module.get_db()
    db = next(db_generator)
    upload_file = DummyUploadFile("fas2750.log", SAMPLE_LOG.encode("utf-8"))

    try:
        payload = asyncio.run(
            main_module.upload_log(file=upload_file, save_name="fas2750.log", db=db)
        )
    finally:
        db_generator.close()

    return payload


def test_root_serves_html_ui(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)

    response = main_module.root()
    body = response.body.decode("utf-8")

    assert isinstance(response, HTMLResponse)
    assert "/static/app.css" in body
    assert "/static/app.js" in body
    assert (Path(main_module.TEMPLATE_DIR) / "index.html").exists()
    assert (Path(main_module.STATIC_DIR) / "app.css").exists()
    assert (Path(main_module.STATIC_DIR) / "app.js").exists()


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
    assert payload["summary"] == {
        "vendor": "NetApp",
        "cluster_name": "FAS2750",
        "model_name": "FAS2750",
        "ontap_version": "9.17.1P2",
        "disk_count": 2,
        "controller_serial": "952047001063,952047000902",
    }
    assert summary_path.read_text(encoding="utf-8") == (
        "vendor: NetApp\n"
        "cluster_name: FAS2750\n"
        "model_name: FAS2750\n"
        "ontap_version: 9.17.1P2\n"
        "disk_count: 2\n"
        "controller_serial: 952047001063,952047000902\n"
    )


def test_get_log_summary_returns_detail_payload(monkeypatch, tmp_path):
    main_module = load_app(monkeypatch, tmp_path)
    main_module.on_startup()

    upload_payload = create_uploaded_log(main_module)

    db_generator = main_module.get_db()
    db = next(db_generator)
    try:
        payload = main_module.get_log_summary(upload_payload["id"], db=db)
    finally:
        db_generator.close()

    assert payload["summary_filename"] == "fas2750_summary.txt"
    assert payload["summary_stored_path"].endswith("fas2750_summary.txt")
    assert payload["summary"] == {
        "vendor": "NetApp",
        "cluster_name": "FAS2750",
        "model_name": "FAS2750",
        "ontap_version": "9.17.1P2",
        "disk_count": "2",
        "controller_serial": "952047001063,952047000902",
    }
    assert "vendor: NetApp" in payload["raw_text"]
