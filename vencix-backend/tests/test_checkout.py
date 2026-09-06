def test_get_plans(client):
    resp = client.get("/api/checkout/plans")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "basico" in data["plans"]
    assert "pro" in data["plans"]


def test_create_pix_charge_success(client):
    resp = client.post("/api/checkout/pix", json={"plan": "pro"})
    assert resp.status_code == 201
    data = resp.get_json()
    assert "txid" in data
    assert data["amount"] == 169.00
    assert data["plan"] == "pro"


def test_create_pix_charge_invalid_plan(client):
    resp = client.post("/api/checkout/pix", json={"plan": "plano_inexistente"})
    assert resp.status_code == 400


def test_process_card_payment(client):
    resp = client.post(
        "/api/checkout/card",
        json={"plan": "basico", "method": "credito"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["amount"] == 69.00


def test_gateway_webhook(client):
    # Criar uma transação Pix primeiro
    resp_pix = client.post("/api/checkout/pix", json={"plan": "basico"})
    txid = resp_pix.get_json()["txid"]

    # Simular webhook de confirmação do gateway
    resp_wh = client.post(
        "/api/checkout/webhook",
        json={"txid": txid, "status": "approved"},
    )
    assert resp_wh.status_code == 200

    # Verificar status atualizado
    resp_status = client.get(f"/api/checkout/status/{txid}")
    assert resp_status.status_code == 200
    assert resp_status.get_json()["status"] == "approved"
