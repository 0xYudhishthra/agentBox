import pytest
from pydantic import ValidationError
from app.schemas import ConnectionCreate, ConnectionRead


def test_requires_exactly_one_auth():
    with pytest.raises(ValidationError):
        ConnectionCreate(name="b", ip_address="1.1.1.1", user="root")  # neither
    with pytest.raises(ValidationError):
        ConnectionCreate(name="b", ip_address="1.1.1.1", user="root",
                         ssh_key_path="/k", password="p")  # both
    ok = ConnectionCreate(name="b", ip_address="1.1.1.1", user="root", ssh_key_path="/k")
    assert ok.port == 22


def test_read_model_excludes_secrets():
    fields = ConnectionRead.model_fields.keys()
    assert "password" not in fields
    assert "ssh_key_path" not in fields
