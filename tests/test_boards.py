def login(client, username: str, password: str):
    return client.post("/auth/login", json={"username": username, "password": password})


def approve_user(client, user_id: int):
    response = client.put(f"/admin/users/{user_id}/status", json={"is_active": True})
    assert response.status_code == 200


def test_shared_request_and_bug_board_crud_for_general_user(client):
    admin_login = login(client, "admin", "secret123")
    assert admin_login.status_code == 200

    register_response = client.post(
        "/auth/register",
        json={"username": "boarduser", "password": "pw1234", "full_name": "Board User"},
    )
    assert register_response.status_code == 200
    user = register_response.json()
    approve_user(client, user["id"])

    client.post("/auth/logout")
    user_login = login(client, "boarduser", "pw1234")
    assert user_login.status_code == 200

    request_create = client.post(
        "/requests",
        json={"title": "로그 수정 요청", "content": "스토리지2 확인 필요", "status": "대기"},
    )
    assert request_create.status_code == 200
    request_post = request_create.json()
    assert request_post["author"] == "Board User"

    request_update = client.put(
        f"/requests/{request_post['id']}",
        json={"title": "로그 수정 요청", "content": "스토리지2 수정 완료", "status": "진행중", "author": "Board User"},
    )
    assert request_update.status_code == 200
    assert request_update.json()["status"] == "진행중"

    request_list = client.get("/requests")
    assert request_list.status_code == 200
    assert request_list.json()[0]["content"] == "스토리지2 수정 완료"

    bug_create = client.post(
        "/bugs",
        json={"title": "버그 제보", "content": "storage3 목록 깜빡임"},
    )
    assert bug_create.status_code == 200
    bug_post = bug_create.json()
    assert bug_post["author"] == "Board User"

    bug_update = client.put(
        f"/bugs/{bug_post['id']}",
        json={"title": "버그 제보", "content": "storage3 목록 깜빡임 재현 완료", "author": "Board User"},
    )
    assert bug_update.status_code == 200
    assert bug_update.json()["content"] == "storage3 목록 깜빡임 재현 완료"

    bug_list = client.get("/bugs")
    assert bug_list.status_code == 200
    assert bug_list.json()[0]["content"] == "storage3 목록 깜빡임 재현 완료"

    delete_request = client.delete(f"/requests/{request_post['id']}")
    assert delete_request.status_code == 200
    assert delete_request.json()["deleted"] is True

    delete_bug = client.delete(f"/bugs/{bug_post['id']}")
    assert delete_bug.status_code == 200
    assert delete_bug.json()["deleted"] is True
