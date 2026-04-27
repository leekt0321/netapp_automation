import importlib
from pathlib import Path

from fastapi.testclient import TestClient


def login(client, username: str, password: str):
    return client.post("/auth/login", json={"username": username, "password": password})


def approve_user(client, user_id: int):
    response = client.put(f"/admin/users/{user_id}/status", json={"is_active": True})
    assert response.status_code == 200


def create_site_as_admin(client, storage_name: str, name: str) -> dict:
    response = client.post("/sites", json={"storage_name": storage_name, "name": name})
    assert response.status_code == 200
    return response.json()


def test_log_upload_summary_and_admin_review_flow(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    register_response = client.post(
        "/auth/register",
        json={"username": "loguser", "password": "pw1234", "full_name": "Log User"},
    )
    assert register_response.status_code == 200
    approve_user(client, register_response.json()["id"])

    client.post("/auth/logout")
    user_login = login(client, "loguser", "pw1234")
    assert user_login.status_code == 200

    upload_response = client.post(
        "/upload",
        data={
            "save_name": "fas2750.log",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("fas2750.log", sample_log, "text/plain")},
    )
    assert upload_response.status_code == 200
    payload = upload_response.json()
    log_item = payload["latest"]

    raw_path = Path(log_item["stored_path"])
    summary_path = Path(log_item["summary_stored_path"])
    assert raw_path.exists()
    assert summary_path.exists()
    assert summary_path.parent == upload_dir

    list_response = client.get("/logs", params={"storage_name": "storage1", "site_id": site["id"]})
    assert list_response.status_code == 200
    logs = list_response.json()
    assert len(logs) == 1
    assert logs[0]["summary_stored_path"] == str(summary_path)

    summary_response = client.get(f"/logs/{log_item['id']}/summary")
    assert summary_response.status_code == 200
    summary_payload = summary_response.json()
    assert summary_payload["summary_stored_path"] == str(summary_path)
    assert summary_payload["parsed_summary"]["hostname"] == "FAS2750"

    request_response = client.post(
        f"/logs/{log_item['id']}/deletion-requests",
        json={"reason": "정리 요청"},
    )
    assert request_response.status_code == 200
    deletion_request = request_response.json()
    assert deletion_request["status"] == "pending"

    client.post("/auth/logout")
    admin_relogin = login(client, "admin", "secret123")
    assert admin_relogin.status_code == 200

    pending_response = client.get("/admin/deletion-requests", params={"status": "pending"})
    assert pending_response.status_code == 200
    pending_items = pending_response.json()
    assert len(pending_items) == 1
    assert pending_items[0]["target_id"] == log_item["id"]

    review_response = client.put(
        f"/admin/deletion-requests/{deletion_request['id']}/review",
        json={"action": "approve", "comment": "삭제 승인"},
    )
    assert review_response.status_code == 200
    reviewed = review_response.json()
    assert reviewed["status"] == "executed"
    assert reviewed["executed_at"] is not None

    assert raw_path.exists() is False
    assert summary_path.exists() is False

    empty_list = client.get("/logs", params={"storage_name": "storage1", "site_id": site["id"]})
    assert empty_list.status_code == 200
    assert empty_list.json() == []


def test_upload_multiple_files_counts_each_file_once(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    upload_response = client.post(
        "/upload",
        data={
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
            "save_names": ["one.log", "two.log"],
        },
        files=[
            ("files", ("one.log", sample_log, "text/plain")),
            ("files", ("two.log", sample_log, "text/plain")),
        ],
    )
    assert upload_response.status_code == 200
    payload = upload_response.json()
    assert payload["count"] == 2
    assert len(payload["items"]) == 2

    list_response = client.get("/logs", params={"storage_name": "storage1", "site_id": site["id"]})
    assert list_response.status_code == 200
    assert len(list_response.json()) == 2
    assert len([path for path in upload_dir.iterdir() if path.name.endswith(".log")]) == 2


def test_raw_log_preview_decodes_utf16_le(client, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")
    utf16_log = sample_log.encode("utf-16-le")

    upload_response = client.post(
        "/upload",
        data={
            "save_name": "utf16.log",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("utf16.log", utf16_log, "text/plain")},
    )
    assert upload_response.status_code == 200
    log_item = upload_response.json()["latest"]

    raw_response = client.get(f"/logs/{log_item['id']}/raw")
    assert raw_response.status_code == 200
    raw_text = raw_response.json()["raw_text"]
    assert "FAS2750::*>" in raw_text
    assert "\x00" not in raw_text


def test_upload_rejects_invalid_site_and_does_not_create_files(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage2", "하나클라우디아")

    response = client.post(
        "/upload",
        data={
            "save_name": "invalid.log",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("invalid.log", sample_log, "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "선택한 스토리지에 등록된 사이트만 업로드할 수 있습니다."
    assert list(upload_dir.iterdir()) == []


def test_summary_returns_404_when_summary_file_is_missing(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    upload_response = client.post(
        "/upload",
        data={
            "save_name": "missing-summary.log",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("missing-summary.log", sample_log, "text/plain")},
    )
    assert upload_response.status_code == 200
    log_item = upload_response.json()["latest"]

    summary_path = Path(log_item["summary_stored_path"])
    summary_path.unlink()

    summary_response = client.get(f"/logs/{log_item['id']}/summary")
    assert summary_response.status_code == 404
    assert summary_response.json()["detail"] == "summary 파일을 찾을 수 없습니다."


def test_upload_cleanup_runs_when_parser_fails(upload_dir: Path, app_module, monkeypatch):
    log_service = importlib.import_module("app.services.log_service")
    def raise_parse_error(_: str):
        raise RuntimeError("parser exploded")

    monkeypatch.setattr(log_service, "parse_netapp_log", raise_parse_error)

    with TestClient(app_module.app, raise_server_exceptions=False) as client:
        admin_login = login(client, "admin", "secret123")
        assert admin_login.status_code == 200

        site = create_site_as_admin(client, "storage1", "하나금융티아이")

        response = client.post(
            "/upload",
            data={
                "save_name": "cleanup.log",
                "storage_name": "storage1",
                "site_id": str(site["id"]),
                "manual_fields_json": "",
            },
            files={"file": ("cleanup.log", "bad log", "text/plain")},
        )
        assert response.status_code == 500
    assert list(upload_dir.iterdir()) == []


def test_upload_rejects_disallowed_file_extension(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    response = client.post(
        "/upload",
        data={
            "save_name": "malware.exe",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("malware.exe", sample_log, "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "업로드 가능한 파일 형식은 .log, .txt 뿐입니다."
    assert list(upload_dir.iterdir()) == []


def test_upload_rejects_disallowed_save_name_extension(client, upload_dir: Path, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    response = client.post(
        "/upload",
        data={
            "save_name": "renamed.exe",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("safe.log", sample_log, "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "업로드 가능한 파일 형식은 .log, .txt 뿐입니다."
    assert list(upload_dir.iterdir()) == []
