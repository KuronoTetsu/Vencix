import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Defina FLASK_DEBUG=1 no .env para ativar o modo debug localmente.
    # Em produção, NUNCA sete FLASK_DEBUG=1 — o Werkzeug Debugger permite
    # execução de código arbitrário no servidor via browser.
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug, port=5000)
