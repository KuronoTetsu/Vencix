from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

from ..extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    products = db.relationship(
        "Product", backref="owner", lazy=True, cascade="all, delete-orphan"
    )

    def set_password(self, raw_password):
        # scrypt (padrão do Werkzeug) — nunca armazene senha em texto puro nem com MD5/SHA simples
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email}

    def __repr__(self):
        return f"<User {self.email}>"
