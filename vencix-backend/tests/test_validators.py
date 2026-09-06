from app.utils.validators import validate_registration, validate_product


def test_validate_registration_success():
    data = {
        "name": "João da Silva",
        "email": "joao@example.com",
        "password": "SenhaSegura123",
    }
    errors = validate_registration(data)
    assert errors == {}


def test_validate_registration_short_password():
    data = {
        "name": "João",
        "email": "joao@example.com",
        "password": "12345",  # menos de 8
    }
    errors = validate_registration(data)
    assert "password" in errors
    assert "8 caracteres" in errors["password"]


def test_validate_registration_long_password():
    data = {
        "name": "João",
        "email": "joao@example.com",
        "password": "a" * 129,  # mais de 128
    }
    errors = validate_registration(data)
    assert "password" in errors
    assert "máximo 128" in errors["password"]


def test_validate_registration_invalid_email():
    data = {
        "name": "João",
        "email": "joao-invalido",
        "password": "SenhaSegura123",
    }
    errors = validate_registration(data)
    assert "email" in errors


def test_validate_product_success():
    data = {
        "name": "Iogurte Natural 170g",
        "ean": "7891000100103",
        "expiry": "2026-10-15",
        "quantity": 10,
    }
    errors = validate_product(data)
    assert errors == {}


def test_validate_product_invalid_ean():
    data = {
        "name": "Iogurte",
        "ean": "123",  # menos de 8 dígitos
        "expiry": "2026-10-15",
        "quantity": 1,
    }
    errors = validate_product(data)
    assert "ean" in errors


def test_validate_product_invalid_quantity():
    data = {
        "name": "Iogurte",
        "expiry": "2026-10-15",
        "quantity": 0,
    }
    errors = validate_product(data)
    assert "quantity" in errors
