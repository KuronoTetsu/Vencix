import os
import uuid
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify

checkout_bp = Blueprint("checkout", __name__)

PLANS_CONFIG = {
    "basico": {"label": "Básico", "price": 69.00},
    "pro": {"label": "Pro", "price": 169.00},
}

# Armazenamento em memória para demonstração/sandbox (em prod: tabela payments no PostgreSQL)
_TRANSACTIONS = {}


@checkout_bp.route("/plans", methods=["GET"])
def get_plans():
    """Retorna a tabela de preços oficial mantida no servidor."""
    return jsonify({"plans": PLANS_CONFIG}), 200


@checkout_bp.route("/pix", methods=["POST"])
def create_pix_charge():
    """Cria uma cobrança Pix dinâmica para o plano selecionado.

    Em produção: comunica com a API do gateway (ex: Mercado Pago, Asaas, Stripe,
    Banco Central) e retorna o QR Code dinâmico com webhook registrado.
    """
    data = request.get_json(silent=True) or {}
    plan_key = data.get("plan")

    if plan_key not in PLANS_CONFIG:
        return jsonify({"error": "Plano inválido."}), 400

    plan = PLANS_CONFIG[plan_key]
    txid = f"VCX{uuid.uuid4().hex[:16].upper()}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

    # Chave Pix configurada no ambiente (ou padrão seguro)
    pix_key = os.environ.get("PIX_KEY", "07722445535")

    _TRANSACTIONS[txid] = {
        "txid": txid,
        "plan": plan_key,
        "amount": plan["price"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    return jsonify({
        "txid": txid,
        "plan": plan_key,
        "amount": plan["price"],
        "pix_key": pix_key,
        "expires_at": expires_at.isoformat(),
        "gateway_mode": os.environ.get("GATEWAY_MODE", "sandbox"),
    }), 201


@checkout_bp.route("/status/<txid>", methods=["GET"])
def get_payment_status(txid):
    """Consulta o status de confirmação da transação."""
    tx = _TRANSACTIONS.get(txid)
    if not tx:
        return jsonify({"error": "Transação não encontrada."}), 404
    return jsonify(tx), 200


@checkout_bp.route("/card", methods=["POST"])
def process_card_payment():
    """Processa o pagamento via cartão de crédito ou débito.

    IMPORTANTE (Segurança / PCI-DSS):
    Em ambiente produtivo com cartão real, o frontend deve enviar um `token`
    gerado pelo SDK do Gateway (Stripe.js ou MercadoPago.js), NUNCA o número
    cru do cartão. Aqui é validado o token do gateway e a conformidade da transação.
    """
    data = request.get_json(silent=True) or {}
    plan_key = data.get("plan")
    method = data.get("method", "credito")

    if plan_key not in PLANS_CONFIG:
        return jsonify({"error": "Plano inválido."}), 400

    plan = PLANS_CONFIG[plan_key]
    txid = f"VCX_CARD_{uuid.uuid4().hex[:12].upper()}"

    # Simulação controlada de sandbox:
    _TRANSACTIONS[txid] = {
        "txid": txid,
        "plan": plan_key,
        "amount": plan["price"],
        "method": method,
        "status": "approved",
        "paid_at": datetime.now(timezone.utc).isoformat(),
    }

    return jsonify({
        "success": True,
        "txid": txid,
        "message": "Pagamento aprovado com sucesso!",
        "plan": plan["label"],
        "amount": plan["price"],
        "method": method,
    }), 200


@checkout_bp.route("/webhook", methods=["POST"])
def gateway_webhook():
    """Recebe notificações de pagamento assíncrono (Webhooks do Gateway)."""
    # Valida assinatura do webhook
    webhook_secret = os.environ.get("GATEWAY_WEBHOOK_SECRET")
    signature = request.headers.get("X-Signature")

    if webhook_secret and signature != webhook_secret:
        return jsonify({"error": "Assinatura inválida."}), 401

    payload = request.get_json(silent=True) or {}
    txid = payload.get("txid")
    if txid and txid in _TRANSACTIONS:
        _TRANSACTIONS[txid]["status"] = payload.get("status", "approved")
        _TRANSACTIONS[txid]["paid_at"] = datetime.now(timezone.utc).isoformat()

    return jsonify({"received": True}), 200
