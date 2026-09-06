# VenciX — Backend (Flask + PostgreSQL + JWT)

## 1. Setup do ambiente

```bash
cd vencix-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edite o `.env`:
- Gere chaves fortes: `python -c "import secrets; print(secrets.token_hex(32))"` (rode duas vezes, uma para SECRET_KEY e outra para JWT_SECRET_KEY)
- Ajuste `DATABASE_URL` com usuário/senha/banco reais do seu PostgreSQL
- Ajuste `CORS_ORIGINS` com a URL de onde o frontend vai rodar (ex.: Live Server)

## 2. Criar o banco no PostgreSQL

```sql
CREATE DATABASE vencix_db;
CREATE USER vencix_user WITH PASSWORD 'senha_forte';
GRANT ALL PRIVILEGES ON DATABASE vencix_db TO vencix_user;
```

## 3. Migrações (cria as tabelas users e products)

```bash
export FLASK_APP=run.py
flask db init
flask db migrate -m "cria tabelas users e products"
flask db upgrade
```

## 4. Rodar a API

```bash
python run.py
```
A API sobe em `http://127.0.0.1:5000`. Teste com `curl http://127.0.0.1:5000/api/health`.

## Endpoints

| Método | Rota                  | Autenticado | Descrição                          |
|--------|------------------------|:-----------:|-------------------------------------|
| POST   | /api/auth/register      | não | Cria usuário                        |
| POST   | /api/auth/login         | não | Retorna access_token + refresh_token|
| POST   | /api/auth/refresh       | refresh token | Renova o access_token          |
| GET    | /api/auth/me            | sim | Dados do usuário logado             |
| GET    | /api/products?q=&month= | sim | Lista produtos do usuário + KPIs    |
| POST   | /api/products            | sim | Cria produto                        |
| PUT    | /api/products/<id>       | sim | Atualiza produto                    |
| DELETE | /api/products/<id>       | sim | Remove produto                      |

Todo produto é isolado por `user_id` — um usuário nunca enxerga ou altera produto de outro (multiusuário real).

## 5. Ajustes necessários no frontend

1. Coloque `api.js` **antes** de `auth.js` e de `dashb.js` nos respectivos HTMLs:
   ```html
   <script src="api.js"></script>
   <script src="auth.js"></script>
   ```
   e
   ```html
   <script src="api.js"></script>
   <script src="dashb.js"></script>
   ```
2. Se `vencix-auth.html` tiver um formulário de cadastro, confirme que os campos têm os ids `su-name`, `su-email`, `su-pass` (ajuste em `auth.js` se os ids reais forem outros).
3. Adicione um botão de logout no dashboard, por exemplo:
   ```html
   <button id="logout-btn">Sair</button>
   ```
4. Ajuste `API_BASE_URL` em `api.js` quando for para produção (hoje aponta para `http://127.0.0.1:5000/api`).

## Decisões de segurança tomadas (e por quê)

- **Hash de senha com Werkzeug (scrypt)** — nunca armazenamos senha em texto puro nem MD5/SHA simples.
- **JWT com access token curto (2h) + refresh token (30 dias)** — reduz a janela de uso de um token vazado; `api.js` já faz o refresh automático em caso de 401.
- **Validação duplicada (client + server)** — a validação HTML5/JS do front é só UX; o backend sempre revalida, porque qualquer pessoa pode chamar a API direto, sem passar pelo seu frontend.
- **Isolamento por `user_id` em toda query de produto** — impede que um usuário edite/exclua produto de outro só adivinhando o ID.
- **Rate limiting em login/registro** (Flask-Limiter) — mitiga força bruta de senha e spam de cadastro.
- **CORS restrito por variável de ambiente** — em vez de `*`, só as origens que você definir.
- **Segredos fora do código** (`.env`, no `.gitignore`) — nunca commite `SECRET_KEY`/`JWT_SECRET_KEY`/senha do banco.
- **Mensagem de erro genérica no login** ("e-mail ou senha inválidos") — evita que um atacante descubra quais e-mails existem cadastrados.

## Próximos passos sugeridos (fora do escopo desta entrega)

- Servir o frontend por HTTPS e mover o backend para trás de um proxy (nginx) com HTTPS também.
- Se quiser reduzir a exposição do JWT a XSS, migrar de `localStorage` para cookie `httpOnly` + `SameSite=Strict` (exige ajustar CORS e as chamadas fetch com `credentials: 'include'`).
- Endpoint de recuperação de senha (envio de e-mail com token de reset).
- Paginação em `/api/products` quando o catálogo crescer muito.
