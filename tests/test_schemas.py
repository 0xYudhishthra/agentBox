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
    # raw password is never exposed; ssh_key_path (a path, not key material) is
    # returned per the API spec's GET /connections payload
    assert "password" not in fields
    assert "ssh_key_path" in fields
