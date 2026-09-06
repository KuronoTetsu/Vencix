import re

EAN_RE = re.compile(r"^[0-9]{8,13}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_registration(data):
    """Validação SERVER-SIDE — a validação HTML5 do front (required, type=email)
    é só UX. O servidor nunca pode confiar apenas nela, pois o cliente pode
    enviar qualquer coisa direto pra API."""
    errors = {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        errors["name"] = "Nome é obrigatório."
    elif len(name) > 120:
        errors["name"] = "Nome muito longo."

    if not email or not EMAIL_RE.match(email):
        errors["email"] = "E-mail inválido."

    if len(password) < 8:
        errors["password"] = "A senha precisa ter pelo menos 8 caracteres."
    elif len(password) > 128:
        errors["password"] = "Senha muito longa (máximo 128 caracteres)."

    return errors


def validate_product(data):
    errors = {}
    name = (data.get("name") or "").strip()
    ean = (data.get("ean") or "").strip()
    expiry = (data.get("expiry") or "").strip()
    quantity = data.get("quantity")

    if not name:
        errors["name"] = "Nome do produto é obrigatório."
    elif len(name) > 200:
        errors["name"] = "Nome muito longo."

    if ean and not EAN_RE.match(ean):
        errors["ean"] = "Código EAN deve conter entre 8 e 13 dígitos."

    if not expiry:
        errors["expiry"] = "Data de validade é obrigatória."

    try:
        if quantity is None or int(quantity) < 1:
            errors["quantity"] = "Quantidade deve ser no mínimo 1."
    except (TypeError, ValueError):
        errors["quantity"] = "Quantidade inválida."

    return errors
