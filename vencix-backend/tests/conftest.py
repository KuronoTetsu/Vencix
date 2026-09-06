import pytest
from app import create_app
from app.config import TestConfig
from app.extensions import db as _db
from app.models import User, Product


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_user(app):
    with app.app_context():
        user = User(name="Usuário Teste", email="teste@vencix.com")
        user.set_password("SenhaForte123")
        _db.session.add(user)
        _db.session.commit()
        return {"id": user.id, "email": "teste@vencix.com", "password": "SenhaForte123", "name": "Usuário Teste"}


@pytest.fixture
def auth_client(client, auth_user):
    # Faz login para gravar os cookies no test_client
    resp = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    assert resp.status_code == 200
    return client
