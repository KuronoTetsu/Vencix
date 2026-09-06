from datetime import datetime, timezone, date

from ..extensions import db


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name = db.Column(db.String(200), nullable=False)
    ean = db.Column(db.String(13), nullable=True)
    expiry_date = db.Column(db.Date, nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def status(self):
        """Mesma regra de negócio que existia no front (getStatus em dashb.js),
        agora centralizada no backend para não divergir entre telas/clientes."""
        today = date.today()
        days = (self.expiry_date - today).days
        if days < 0:
            return {"cls": "status-danger", "label": "Vencido"}
        if days <= 7:
            return {"cls": "status-danger", "label": "Urgente"}
        if days <= 15:
            return {"cls": "status-warn", "label": "Atenção"}
        if days <= 30:
            return {"cls": "status-warn", "label": "Em breve"}
        return {"cls": "status-ok", "label": "Em dia"}

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "ean": self.ean,
            "expiry": self.expiry_date.isoformat(),
            "quantity": self.quantity,
            "status": self.status(),
        }

    def __repr__(self):
        return f"<Product {self.name} ({self.expiry_date})>"
