from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Product
from ..utils.validators import validate_product

products_bp = Blueprint("products", __name__)


def _get_owned_product(product_id, user_id):
    """Toda leitura/edição/exclusão de produto passa por aqui — garante que um
    usuário NUNCA acesse ou altere produto de outro usuário (isolamento
    multi-tenant), mesmo que ele adivinhe o ID de outro registro."""
    return Product.query.filter_by(id=product_id, user_id=user_id).first()


def _parse_expiry(data):
    try:
        return datetime.strptime(data["expiry"], "%Y-%m-%d").date(), None
    except (KeyError, ValueError):
        return None, {"expiry": "Data inválida. Use o formato AAAA-MM-DD."}


@products_bp.route("", methods=["GET"])
@jwt_required()
def list_products():
    user_id = get_jwt_identity()
    search = request.args.get("q", "").strip().lower()
    month  = request.args.get("month", "").strip()  # formato YYYY-MM

    # Uma única query busca todos os produtos para calcular os KPIs (sempre sem filtro).
    all_products = Product.query.filter_by(user_id=user_id).all()
    safe   = sum(1 for p in all_products if p.status()["cls"] == "status-ok")
    warn   = sum(1 for p in all_products if p.status()["cls"] == "status-warn")
    danger = sum(1 for p in all_products if p.status()["cls"] == "status-danger")

    # Filtros aplicados diretamente no SQL — não carrega tudo na memória para filtrar.
    query = Product.query.filter_by(user_id=user_id)
    if search:
        query = query.filter(
            db.or_(
                Product.name.ilike(f"%{search}%"),
                Product.ean.ilike(f"%{search}%"),
            )
        )
    if month:
        try:
            year, m = month.split("-")
            query = query.filter(
                db.extract("year",  Product.expiry_date) == int(year),
                db.extract("month", Product.expiry_date) == int(m),
            )
        except ValueError:
            pass  # formato inválido — ignora o filtro de mês silenciosamente

    products = query.order_by(Product.expiry_date).all()

    return jsonify(
        {
            "products": [p.to_dict() for p in products],
            "kpis": {"total": len(all_products), "safe": safe, "warn": warn, "danger": danger},
        }
    ), 200


@products_bp.route("", methods=["POST"])
@jwt_required()
def create_product():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    errors = validate_product(data)
    expiry_date, expiry_error = _parse_expiry(data)
    if expiry_error:
        errors.update(expiry_error)
    if errors:
        return jsonify({"errors": errors}), 400

    product = Product(
        user_id=user_id,
        name=data["name"].strip(),
        ean=(data.get("ean") or "").strip() or None,
        expiry_date=expiry_date,
        quantity=int(data["quantity"]),
    )
    db.session.add(product)
    db.session.commit()

    return jsonify({"message": "Produto cadastrado!", "product": product.to_dict()}), 201


@products_bp.route("/<int:product_id>", methods=["PUT"])
@jwt_required()
def update_product(product_id):
    user_id = get_jwt_identity()
    product = _get_owned_product(product_id, user_id)
    if not product:
        return jsonify({"error": "Produto não encontrado."}), 404

    data = request.get_json(silent=True) or {}
    errors = validate_product(data)
    expiry_date, expiry_error = _parse_expiry(data)
    if expiry_error:
        errors.update(expiry_error)
    if errors:
        return jsonify({"errors": errors}), 400

    product.name = data["name"].strip()
    product.ean = (data.get("ean") or "").strip() or None
    product.expiry_date = expiry_date
    product.quantity = int(data["quantity"])
    db.session.commit()

    return jsonify({"message": "Produto atualizado!", "product": product.to_dict()}), 200


@products_bp.route("/<int:product_id>", methods=["DELETE"])
@jwt_required()
def delete_product(product_id):
    user_id = get_jwt_identity()
    product = _get_owned_product(product_id, user_id)
    if not product:
        return jsonify({"error": "Produto não encontrado."}), 404

    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Produto excluído."}), 200
