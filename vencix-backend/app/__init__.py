from dotenv import load_dotenv

load_dotenv()  # precisa rodar ANTES de importar Config, que lê variáveis de ambiente

from flask import Flask, jsonify

from .config import Config
from .extensions import db, migrate, jwt, cors, limiter


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
        allow_headers=["Content-Type", "X-CSRF-TOKEN"],
    )
    limiter.init_app(app)

    from .routes.auth import auth_bp
    from .routes.products import products_bp
    from .routes.checkout import checkout_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(products_bp, url_prefix="/api/products")
    app.register_blueprint(checkout_bp, url_prefix="/api/checkout")

    from . import models  # noqa: F401 — garante que os modelos sejam registrados no SQLAlchemy

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Recurso não encontrado."}), 404

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "Erro interno do servidor."}), 500

    @jwt.expired_token_loader
    def expired_token_callback(_jwt_header, _jwt_payload):
        return jsonify({"error": "Sessão expirada. Faça login novamente."}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(_reason):
        return jsonify({"error": "Token inválido."}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(_reason):
        return jsonify({"error": "Autenticação necessária."}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(_jwt_header, _jwt_payload):
        return jsonify({"error": "Token revogado."}), 401

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"}), 200

    return app
