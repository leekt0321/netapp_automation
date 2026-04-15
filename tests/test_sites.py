def login(client, username: str, password: str):
    return client.post("/auth/login", json={"username": username, "password": password})


def approve_user(client, user_id: int):
    response = client.put(f"/admin/users/{user_id}/status", json={"is_active": True})
    assert response.status_code == 200


def test_non_admin_cannot_manage_sites_but_can_list_them(client):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    create_site = client.post("/sites", json={"storage_name": "storage2", "name": "하나클라우디아"})
    assert create_site.status_code == 200
    created_site = create_site.json()
    assert created_site["storage_name"] == "storage2"

    register_response = client.post(
        "/auth/register",
        json={"username": "siteuser", "password": "pw1234", "full_name": "Site User"},
    )
    assert register_response.status_code == 200
    user = register_response.json()
    approve_user(client, user["id"])

    client.post("/auth/logout")
    user_login = login(client, "siteuser", "pw1234")
    assert user_login.status_code == 200

    list_response = client.get("/sites", params={"storage_name": "storage2"})
    assert list_response.status_code == 200
    assert list_response.json()[0]["name"] == "하나클라우디아"

    forbidden_create = client.post("/sites", json={"storage_name": "storage2", "name": "새 사이트"})
    assert forbidden_create.status_code == 403
    assert forbidden_create.json()["detail"] == "관리자 권한이 필요합니다."
