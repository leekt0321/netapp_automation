def login(client, username: str, password: str):
    return client.post("/auth/login", json={"username": username, "password": password})


def test_register_requires_admin_approval_before_login(client):
    register_response = client.post(
        "/auth/register",
        json={"username": "user1", "password": "pw1234", "full_name": "User One"},
    )

    assert register_response.status_code == 200
    registered_user = register_response.json()
    assert registered_user["username"] == "user1"
    assert registered_user["is_active"] is False
    assert registered_user["approval_pending"] is True

    pending_login = login(client, "user1", "pw1234")
    assert pending_login.status_code == 403
    assert pending_login.json()["detail"] == "관리자 승인 대기 중인 계정입니다."

    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    approve_response = client.put(
        f"/admin/users/{registered_user['id']}/status",
        json={"is_active": True},
    )
    assert approve_response.status_code == 200
    approved_user = approve_response.json()
    assert approved_user["is_active"] is True
    assert approved_user["approval_pending"] is False
    assert approved_user["approved_at"] is not None

    client.post("/auth/logout")

    approved_login = login(client, "user1", "pw1234")
    assert approved_login.status_code == 200
    assert approved_login.json()["username"] == "user1"

    me_response = client.get("/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["authenticated"] is True


def test_password_change_invalidates_previous_session(client):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    change_response = client.put(
        "/auth/password",
        json={"current_password": "secret123", "new_password": "secret456"},
    )
    assert change_response.status_code == 200
    assert change_response.json()["changed"] is True

    client.post("/auth/logout")

    old_login = login(client, "admin", "secret123")
    assert old_login.status_code == 401

    new_login = login(client, "admin", "secret456")
    assert new_login.status_code == 200
    assert new_login.json()["role"] == "admin"
