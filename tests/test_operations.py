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
