from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)

from ..extensions import db, limiter
from ..models import User
from ..utils.validators import validate_registration

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10 per hour")
def register():
    data = request.get_json(silent=True) or {}
    errors = validate_registration(data)
    if errors:
        return jsonify({"errors": errors}), 400

    email = data["email"].strip().lower()

    # Checagem de duplicidade — o índice único em User.email também protege
    # contra corrida (race condition) entre dois cadastros simultâneos.
    if User.query.filter_by(email=email).first():
        return jsonify({"errors": {"email": "Este e-mail já está cadastrado."}}), 409

    user = User(name=data["name"].strip(), email=email)
    user.set_password(data["password"])

    db.session.add(user)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"errors": {"email": "Este e-mail já está cadastrado."}}), 409

    return jsonify({"message": "Cadastro realizado com sucesso.", "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("15 per 15 minutes")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()

    # Mensagem genérica de propósito: não revelar se foi o e-mail ou a senha
    # que estava errada — evita enumeração de contas cadastradas.
    if not user or not user.check_password(password):
        return jsonify({"error": "E-mail ou senha inválidos."}), 401

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    # Tokens gravados em cookies HttpOnly pelo backend — nunca expostos no JSON.
    # O frontend recebe apenas os dados de exibição do usuário.
    response = jsonify({"user": user.to_dict()})
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response, 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    new_access_token = create_access_token(identity=identity)
    response = jsonify({"message": "Token renovado."})
    set_access_cookies(response, new_access_token)
    return response, 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Limpa os cookies JWT do cliente.

    Não requer autenticação: mesmo um usuário com token expirado
    deve conseguir deslogar e limpar os cookies sem erro 401.
    """
    response = jsonify({"message": "Logout realizado com sucesso."})
    unset_jwt_cookies(response)
    return response, 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "Usuário não encontrado."}), 404
    return jsonify({"user": user.to_dict()}), 200
