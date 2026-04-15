from fastapi.testclient import TestClient


def login(client, username: str, password: str):
    return client.post("/auth/login", json={"username": username, "password": password})


def approve_user(client, user_id: int):
    response = client.put(f"/admin/users/{user_id}/status", json={"is_active": True})
    assert response.status_code == 200
    return response.json()


def create_site_as_admin(client, storage_name: str, name: str) -> dict:
    response = client.post("/sites", json={"storage_name": storage_name, "name": name})
    assert response.status_code == 200
    return response.json()


def test_admin_can_list_sessions_and_deactivate_user_session(app_module, sample_log: str):
    with TestClient(app_module.app) as admin_client, TestClient(app_module.app) as user_client:
        admin_login = login(admin_client, "admin", "secret123")
        assert admin_login.status_code == 200

        register_response = admin_client.post(
            "/auth/register",
            json={"username": "sessionuser", "password": "pw1234", "full_name": "Session User"},
        )
        assert register_response.status_code == 200
        user = register_response.json()
        approve_user(admin_client, user["id"])

        user_login = login(user_client, "sessionuser", "pw1234")
        assert user_login.status_code == 200

        sessions_response = admin_client.get("/admin/sessions")
        assert sessions_response.status_code == 200
        usernames = {item["username"] for item in sessions_response.json()}
        assert {"admin", "sessionuser"}.issubset(usernames)

        deactivate_response = admin_client.put(f"/admin/users/{user['id']}/status", json={"is_active": False})
        assert deactivate_response.status_code == 200
        assert deactivate_response.json()["is_active"] is False

        me_response = user_client.get("/auth/me")
        assert me_response.status_code == 200
        assert me_response.json() == {"authenticated": False, "user": None}


def test_admin_can_reject_log_deletion_request_and_keep_files(client, upload_dir, sample_log: str):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    site = create_site_as_admin(client, "storage1", "하나금융티아이")

    register_response = client.post(
        "/auth/register",
        json={"username": "rejectuser", "password": "pw1234", "full_name": "Reject User"},
    )
    assert register_response.status_code == 200
    approve_user(client, register_response.json()["id"])

    client.post("/auth/logout")
    user_login = login(client, "rejectuser", "pw1234")
    assert user_login.status_code == 200

    upload_response = client.post(
        "/upload",
        data={
            "save_name": "reject.log",
            "storage_name": "storage1",
            "site_id": str(site["id"]),
            "manual_fields_json": "",
        },
        files={"file": ("reject.log", sample_log, "text/plain")},
    )
    assert upload_response.status_code == 200
    log_item = upload_response.json()["latest"]

    raw_path = upload_dir / "reject.log"
    summary_path = upload_dir / "reject_summary.txt"
    assert raw_path.exists()
    assert summary_path.exists()

    request_response = client.post(
        f"/logs/{log_item['id']}/deletion-requests",
        json={"reason": "삭제 보류 확인"},
    )
    assert request_response.status_code == 200
    deletion_request = request_response.json()

    client.post("/auth/logout")
    admin_relogin = login(client, "admin", "secret123")
    assert admin_relogin.status_code == 200

    reject_response = client.put(
        f"/admin/deletion-requests/{deletion_request['id']}/review",
        json={"action": "reject", "comment": "유지 필요"},
    )
    assert reject_response.status_code == 200
    reviewed = reject_response.json()
    assert reviewed["status"] == "rejected"
    assert reviewed["executed_at"] is None

    assert raw_path.exists()
    assert summary_path.exists()
