from app.extensions import db
from app.models import User, Product


def test_create_product(auth_client):
    resp = auth_client.post(
        "/api/products",
        json={
            "name": "Queijo Mussarela 500g",
            "ean": "7891234567890",
            "expiry": "2026-12-31",
            "quantity": 5,
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["product"]["name"] == "Queijo Mussarela 500g"
    assert data["product"]["quantity"] == 5


def test_list_products_and_kpis(auth_client):
    # Criar 2 produtos
    auth_client.post(
        "/api/products",
        json={"name": "Produto A", "expiry": "2026-05-10", "quantity": 2},
    )
    auth_client.post(
        "/api/products",
        json={"name": "Produto B", "expiry": "2026-06-20", "quantity": 4},
    )

    resp = auth_client.get("/api/products")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["products"]) == 2
    assert data["kpis"]["total"] == 2


def test_list_products_filter_search(auth_client):
    auth_client.post(
        "/api/products",
        json={"name": "Requeijão Cremoso", "expiry": "2026-07-15", "quantity": 1},
    )
    auth_client.post(
        "/api/products",
        json={"name": "Manteiga Extra", "expiry": "2026-07-20", "quantity": 1},
    )

    resp = auth_client.get("/api/products?q=Requeijão")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["products"]) == 1
    assert data["products"][0]["name"] == "Requeijão Cremoso"
    # KPI total continua sendo 2
    assert data["kpis"]["total"] == 2


def test_list_products_filter_month(auth_client):
    auth_client.post(
        "/api/products",
        json={"name": "Pão de Forma", "expiry": "2026-08-05", "quantity": 1},
    )
    auth_client.post(
        "/api/products",
        json={"name": "Biscoito", "expiry": "2026-09-15", "quantity": 1},
    )

    resp = auth_client.get("/api/products?month=2026-08")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["products"]) == 1
    assert data["products"][0]["name"] == "Pão de Forma"


def test_multi_tenant_isolation(app, client, auth_client):
    # auth_client cria um produto
    resp = auth_client.post(
        "/api/products",
        json={"name": "Produto Secreto User 1", "expiry": "2026-11-11", "quantity": 3},
    )
    product_id = resp.get_json()["product"]["id"]

    # Cria User 2 no banco
    with app.app_context():
        user2 = User(name="Usuário 2", email="user2@vencix.com")
        user2.set_password("SenhaForte456")
        db.session.add(user2)
        db.session.commit()

    # User 2 faz login
    client2 = app.test_client()
    client2.post("/api/auth/login", json={"email": "user2@vencix.com", "password": "SenhaForte456"})

    # User 2 NÃO deve ver o produto de User 1
    resp_list = client2.get("/api/products")
    assert len(resp_list.get_json()["products"]) == 0

    # User 2 NÃO deve conseguir atualizar o produto de User 1
    resp_update = client2.put(f"/api/products/{product_id}", json={"name": "Invasão", "expiry": "2026-11-11", "quantity": 1})
    assert resp_update.status_code == 404

    # User 2 NÃO deve conseguir deletar o produto de User 1
    resp_delete = client2.delete(f"/api/products/{product_id}")
    assert resp_delete.status_code == 404
