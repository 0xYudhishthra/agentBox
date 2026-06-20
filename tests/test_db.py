from sqlmodel import create_engine, SQLModel, Session
from sqlmodel.pool import StaticPool


def test_init_db_creates_tables(monkeypatch):
    from app import db
    test_engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    monkeypatch.setattr(db, "engine", test_engine)
    db.init_db()
    # session dependency yields a usable Session
    gen = db.get_session()
    session = next(gen)
    assert isinstance(session, Session)
    gen.close()


def test_settings_defaults():
    from app.config import settings
    assert settings.ssh_timeout == 30
    assert "CAP_CHECKPOINT_RESTORE" in settings.required_caps
