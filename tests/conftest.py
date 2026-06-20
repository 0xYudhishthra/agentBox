import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.db import get_session
from app.deps import get_ssh, get_provider_resolver
from tests.fakes import FakeSSH, FakeProvider


@pytest.fixture
def engine():
    e = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(e)
    return e


@pytest.fixture
def fake_ssh():
    return FakeSSH()


@pytest.fixture
def fake_provider():
    return FakeProvider()


@pytest.fixture
def client(engine, fake_ssh, fake_provider):
    def _session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_ssh] = lambda: fake_ssh
    app.dependency_overrides[get_provider_resolver] = lambda: (lambda provider: fake_provider)
    yield TestClient(app)
    app.dependency_overrides.clear()
