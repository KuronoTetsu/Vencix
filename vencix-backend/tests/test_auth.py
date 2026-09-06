def test_register_success(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "name": "Novo Usuário",
            "email": "novo@vencix.com",
            "password": "SenhaForte123",
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "user" in data
    assert data["user"]["email"] == "novo@vencix.com"


def test_register_duplicate_email(client, auth_user):
    resp = client.post(
        "/api/auth/register",
        json={
            "name": "Outro Nome",
            "email": auth_user["email"],
            "password": "OutraSenhaForte123",
        },
    )
    assert resp.status_code == 409
    data = resp.get_json()
    assert "errors" in data
    assert "email" in data["errors"]


def test_login_success_sets_cookies(client, auth_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "user" in data
    # Tokens não devem estar expostos no JSON de resposta
    assert "access_token" not in data
    assert "refresh_token" not in data

    # Deve setar os cookies access e refresh nos headers de resposta
    set_cookies = resp.headers.getlist("Set-Cookie")
    set_cookie_str = " ".join(set_cookies)
    assert "access_token_cookie" in set_cookie_str
    assert "refresh_token_cookie" in set_cookie_str


def test_login_invalid_password(client, auth_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": "SenhaErradaTotal"},
    )
    assert resp.status_code == 401
    data = resp.get_json()
    assert "E-mail ou senha inválidos" in data.get("error", "")


def test_me_authenticated(auth_client, auth_user):
    resp = auth_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["user"]["email"] == auth_user["email"]


def test_me_unauthenticated(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_logout_clears_cookies(auth_client):
    resp = auth_client.post("/api/auth/logout")
    assert resp.status_code == 200
    # Após logout, /api/auth/me deve falhar com 401
    resp_me = auth_client.get("/api/auth/me")
    assert resp_me.status_code == 401
