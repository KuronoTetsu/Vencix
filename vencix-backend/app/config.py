import os
from datetime import timedelta


class Config:
    """Configurações da aplicação, lidas de variáveis de ambiente.

    NUNCA hardcode segredos aqui — SECRET_KEY, JWT_SECRET_KEY e a URL do banco
    sempre vêm do .env (que fica fora do controle de versão).
    """

    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY não definida. Configure o arquivo .env.")

    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    if not SQLALCHEMY_DATABASE_URI:
        raise RuntimeError("DATABASE_URL não definida. Configure o arquivo .env.")

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY não definida. Configure o arquivo .env.")

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Tokens armazenados em cookies HttpOnly — inacessíveis ao JavaScript,
    # protegendo contra ataques XSS que tentam roubar tokens do localStorage.
    # A proteção CSRF usa o padrão Double Submit Cookie: o backend grava um
    # cookie não-HttpOnly (csrf_access_token) que o frontend lê e envia no
    # header X-CSRF-TOKEN em todas as requisições não-GET.
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_SECURE = os.environ.get("FLASK_DEBUG", "0") != "1"  # HTTPS em prod, HTTP em dev
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_CSRF_PROTECT = True

    # Limita o escopo dos cookies: o refresh token só trafega para /api/auth/refresh.
    JWT_ACCESS_COOKIE_PATH = "/"
    JWT_REFRESH_COOKIE_PATH = "/api/auth/refresh"

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://127.0.0.1:5500").split(",")

    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # Aviso em tempo de inicialização: memory:// não é adequado para produção.
    # Em prod, configure RATELIMIT_STORAGE_URI=redis://... no .env do servidor.
    if RATELIMIT_STORAGE_URI == "memory://" and not os.environ.get("FLASK_DEBUG", "0") == "1":
        import warnings
        warnings.warn(
            "RATELIMIT_STORAGE_URI está em 'memory://' — os contadores de rate limit "
            "não serão compartilhados entre workers e serão perdidos a cada restart. "
            "Configure RATELIMIT_STORAGE_URI=redis://... no .env de produção.",
            stacklevel=2,
        )


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_COOKIE_CSRF_PROTECT = False  # sem CSRF em testes unitários
    JWT_COOKIE_SECURE = False        # testes rodam em HTTP
    RATELIMIT_STORAGE_URI = "memory://"
