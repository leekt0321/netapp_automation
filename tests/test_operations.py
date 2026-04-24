from pathlib import Path

from fastapi.testclient import TestClient


def login(client, username: str, password: str):
    return client.post("/auth/login", json={"username": username, "password": password})


def create_site_as_admin(client, storage_name: str, name: str) -> dict:
    response = client.post("/sites", json={"storage_name": storage_name, "name": name})
    assert response.status_code == 200
    return response.json()


def test_health_report_includes_operational_components(client):
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["app"] == "ok"
    assert payload["components"]["db"]["status"] == "ok"
    assert payload["components"]["upload_dir"]["status"] == "ok"
    assert payload["components"]["schema"]["status"] == "ok"
    assert payload["components"]["schema"]["current_revision"] is not None


def test_websocket_health_stream_reports_server_session(client):
    api_response = client.get("/api")
    assert api_response.status_code == 200
    api_payload = api_response.json()

    with client.websocket_connect("/ws/health") as websocket:
        first_message = websocket.receive_json()
        assert first_message["type"] == "server_status"
        assert first_message["status"] == "connected"
        assert first_message["server_session_id"] == api_payload["server_session_id"]
        assert first_message["heartbeat_interval_ms"] > 0


def test_admin_integrity_report_detects_missing_summary_and_orphan_file(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    upload_response = client.post(
        "/upload",
        data={
            "save_name": "integrity.log",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("integrity.log", sample_log, "text/plain")},
    )
    assert upload_response.status_code == 200
    latest = upload_response.json()["latest"]

    Path(latest["summary_stored_path"]).unlink()
    orphan_path = upload_dir / "ghost.log"
    orphan_path.write_text("orphan", encoding="utf-8")

    integrity_response = client.get("/admin/operations/integrity")
    assert integrity_response.status_code == 200
    payload = integrity_response.json()
    assert payload["status"] == "warning"
    assert payload["counts"]["missing_summary_logs"] == 1
    assert payload["counts"]["orphan_raw_files"] == 1
    assert payload["issues"]["missing_summary_logs"][0]["id"] == latest["id"]
    assert str(orphan_path) in payload["issues"]["orphan_raw_files"]


def test_log_list_hides_missing_files_and_admin_cleanup_removes_integrity_issues(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    upload_response = client.post(
        "/upload",
        data={
            "save_name": "cleanup-integrity.log",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("cleanup-integrity.log", sample_log, "text/plain")},
    )
    assert upload_response.status_code == 200
    latest = upload_response.json()["latest"]
    Path(latest["stored_path"]).unlink()
    orphan_path = upload_dir / "orphan.log"
    orphan_path.write_text("orphan", encoding="utf-8")

    list_response = client.get("/logs")
    assert list_response.status_code == 200
    assert list_response.json() == []

    cleanup_response = client.post("/admin/operations/integrity/cleanup")
    assert cleanup_response.status_code == 200
    cleanup_payload = cleanup_response.json()
    assert [item["id"] for item in cleanup_payload["deleted_log_records"]] == [latest["id"]]
    assert str(orphan_path) in cleanup_payload["deleted_files"]
    assert cleanup_payload["report"]["status"] == "ok"

    integrity_response = client.get("/admin/operations/integrity")
    assert integrity_response.status_code == 200
    assert integrity_response.json()["counts"]["uploaded_logs"] == 0
