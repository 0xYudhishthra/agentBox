# agentBox Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a FastAPI + SQLite backend that manages SSH-reachable GPU machines (Connections) and portable agent environments (Workspaces), automating the CRIU/cuda-checkpoint deploy/freeze dance with real SSH and stubbed checkpoint/provider internals.

**Architecture:** Thin FastAPI routers over a service layer. Persistence via SQLModel/SQLite. SSH (paramiko), checkpoint pipeline, and cloud providers each sit behind an interface so the stubbed parts swap to real implementations without touching routes or the state machine. Compatibility enforcement (driver/cuda/topology/privilege) is real field comparison.

**Tech Stack:** Python 3.11+, FastAPI, SQLModel, SQLite, paramiko, pytest.

---

## File Structure

| File | Responsibility |
|---|---|
| `pyproject.toml` | Deps + pytest config |
| `app/__init__.py` | Package marker |
| `app/config.py` | Settings: db path, artifact dir, ssh timeout, required caps |
| `app/db.py` | SQLite engine, `init_db`, `get_session` dependency |
| `app/models.py` | SQLModel tables `Connection`, `Workspace` + enums |
| `app/schemas.py` | Request/response models (secrets excluded, key/password XOR) |
| `app/deps.py` | Injectable deps: `get_ssh`, `get_provider_resolver` |
| `app/services/ssh.py` | `SSHClient` protocol + `ParamikoSSHClient` + `SSHError` |
| `app/services/providers.py` | `ComputeProvider` protocol + local/runpod/vast stubs + `resolve_provider` |
| `app/services/compat.py` | `evaluate(workspace, connection) -> CompatResult` |
| `app/services/checkpoint.py` | 4-step `freeze_workspace` pipeline + `FreezeReport` |
| `app/services/deploy.py` | `deploy_workspace` orchestration |
| `app/routers/connections.py` | GET / POST / DELETE connections |
| `app/routers/workspaces.py` | Workspace CRUD + deploy + freeze + compatible-connections |
| `app/main.py` | FastAPI app, lifespan, router mounting at `/api/v1` |
| `tests/conftest.py` | In-memory DB + dependency overrides + fixtures |
| `tests/fakes.py` | `FakeSSH`, `FakeProvider` recording test doubles |
| `tests/test_*.py` | Per-component tests |

**Scaffold assumptions (documented in README):** deploy treats bundle fields (`config_yaml`, `mcp_json`, `sqlite_db_path`, `entrypoint`) as **file paths** to push; the target host has a reachable Docker daemon; checkpoint steps 1–3 and provider create/destroy are stubs that issue placeholder SSH commands / no-ops.

---

## Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`, `app/__init__.py`, `app/services/__init__.py`, `app/routers/__init__.py`, `tests/__init__.py`, `tests/test_smoke.py`

- [ ] **Step 1: Write the failing test**

`tests/test_smoke.py`:
```python
def test_app_imports():
    from app.main import app
    assert app.title == "agentBox"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_smoke.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: Create the package files**

`pyproject.toml`:
```toml
[project]
name = "agentbox"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn>=0.29",
    "sqlmodel>=0.0.16",
    "paramiko>=3.4",
    "pydantic-settings>=2.2",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

Create empty files: `app/__init__.py`, `app/services/__init__.py`, `app/routers/__init__.py`, `tests/__init__.py`.

Create a minimal `app/main.py` to satisfy the import (expanded in Task 13):
```python
from fastapi import FastAPI

app = FastAPI(title="agentBox")
```

- [ ] **Step 4: Install deps and run test to verify it passes**

Run: `pip install -e ".[dev]" && pytest tests/test_smoke.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml app tests
git commit -m "chore: scaffold agentbox package"
```

---

## Task 2: Config + database

**Files:**
- Create: `app/config.py`, `app/db.py`, `tests/test_db.py`

- [ ] **Step 1: Write the failing test**

`tests/test_db.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_db.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 3: Write the implementation**

`app/config.py`:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGENTBOX_")

    db_path: str = "agentbox.db"
    artifact_dir: str = "local/artifacts"
    ssh_timeout: int = 30
    required_caps: list[str] = ["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"]


settings = Settings()
```

`app/db.py`:
```python
from sqlmodel import SQLModel, Session, create_engine

from .config import settings

engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_db.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/config.py app/db.py tests/test_db.py
git commit -m "feat: add settings and sqlite engine"
```

---

## Task 3: Models

**Files:**
- Create: `app/models.py`, `tests/test_models.py`

- [ ] **Step 1: Write the failing test**

`tests/test_models.py`:
```python
from app.models import Connection, Workspace, ConnStatus, WsStatus, Provider


def test_connection_defaults():
    c = Connection(name="box", ip_address="1.2.3.4", user="root", ssh_key_path="/k")
    assert c.port == 22
    assert c.status == ConnStatus.idle
    assert c.provider == Provider.local
    assert c.privileged is False
    assert c.capabilities == []
    assert isinstance(c.id, str) and len(c.id) > 0


def test_workspace_defaults():
    w = Workspace(
        name="agent", config_yaml="c.yaml", mcp_json="m.json",
        sqlite_db_path="./ctx.db", entrypoint="server.py",
    )
    assert w.status == WsStatus.archived
    assert w.size_gb == 0.0
    assert w.active_connection_id is None
    assert w.frozen_profile is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models'`

- [ ] **Step 3: Write the implementation**

`app/models.py`:
```python
import uuid
from datetime import datetime
from enum import Enum

from sqlmodel import Column, Field, JSON, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class ConnStatus(str, Enum):
    idle = "idle"
    in_use = "in_use"
    offline = "offline"


class Provider(str, Enum):
    runpod = "runpod"
    vast = "vast"
    local = "local"


class WsStatus(str, Enum):
    archived = "archived"
    running = "running"


class Connection(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str
    ip_address: str
    user: str
    port: int = 22
    ssh_key_path: str | None = None
    password: str | None = None
    gpu_type: str | None = None
    driver_version: str | None = None
    cuda_version: str | None = None
    gpu_topology: str | None = None
    provider: Provider = Provider.local
    provider_instance_id: str | None = None
    privileged: bool = False
    capabilities: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    status: ConnStatus = ConnStatus.idle
    last_connected: datetime | None = None


class Workspace(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str
    config_yaml: str
    mcp_json: str
    sqlite_db_path: str
    entrypoint: str
    size_gb: float = 0.0
    status: WsStatus = WsStatus.archived
    active_connection_id: str | None = None
    artifact_path: str | None = None
    frozen_profile: dict | None = Field(default=None, sa_column=Column(JSON))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_models.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/models.py tests/test_models.py
git commit -m "feat: add Connection and Workspace models"
```

---

## Task 4: Schemas + validation

**Files:**
- Create: `app/schemas.py`, `tests/test_schemas.py`

- [ ] **Step 1: Write the failing test**

`tests/test_schemas.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas'`

- [ ] **Step 3: Write the implementation**

`app/schemas.py`:
```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from .models import ConnStatus, Provider, WsStatus


class ConnectionCreate(BaseModel):
    name: str
    ip_address: str
    user: str
    port: int = 22
    ssh_key_path: str | None = None
    password: str | None = None
    gpu_type: str | None = None
    driver_version: str | None = None
    cuda_version: str | None = None
    gpu_topology: str | None = None
    provider: Provider = Provider.local
    provider_instance_id: str | None = None
    privileged: bool = False
    capabilities: list[str] = []

    @model_validator(mode="after")
    def _exactly_one_auth(self):
        if bool(self.ssh_key_path) == bool(self.password):
            raise ValueError("exactly one of ssh_key_path or password is required")
        return self


class ConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    ip_address: str
    user: str
    port: int
    gpu_type: str | None
    driver_version: str | None
    cuda_version: str | None
    gpu_topology: str | None
    provider: Provider
    provider_instance_id: str | None
    privileged: bool
    capabilities: list[str]
    status: ConnStatus
    last_connected: datetime | None


class WorkspaceCreate(BaseModel):
    name: str
    config_yaml: str
    mcp_json: str
    sqlite_db_path: str
    entrypoint: str


class WorkspaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    config_yaml: str
    mcp_json: str
    sqlite_db_path: str
    entrypoint: str
    size_gb: float
    status: WsStatus
    active_connection_id: str | None
    artifact_path: str | None
    frozen_profile: dict | None


class DeployRequest(BaseModel):
    connection_id: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_schemas.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/schemas.py tests/test_schemas.py
git commit -m "feat: add request/response schemas with auth validation"
```

---

## Task 5: Shared test fixtures

**Files:**
- Create: `tests/conftest.py`, `tests/fakes.py`

- [ ] **Step 1: Write the test doubles**

`tests/fakes.py`:
```python
class FakeSSH:
    """Records commands/pushes/pulls; pull writes a small real file."""

    def __init__(self):
        self.commands = []
        self.pushes = []
        self.pulls = []

    def run(self, conn, command):
        self.commands.append(command)
        return 0, "ok", ""

    def push(self, conn, local_path, remote_dir):
        self.pushes.append((local_path, remote_dir))

    def pull(self, conn, remote_path, local_path):
        import os
        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(b"x" * 1024)
        self.pulls.append((remote_path, local_path))

    def test(self, conn):
        return True


class FakeProvider:
    def __init__(self):
        self.created = []
        self.destroyed = []

    def create_instance(self, conn):
        self.created.append(conn.id)
        return conn.provider_instance_id

    def destroy_instance(self, conn):
        self.destroyed.append(conn.id)
```

`tests/conftest.py`:
```python
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
```

- [ ] **Step 2: Note**

No standalone test here; these fixtures are exercised by Tasks 6–13. `conftest.py` imports `app.deps` (Task 10) and a full `app.main` (Task 13), so run its dependent tests only after those tasks. Commit now to lock the doubles in.

- [ ] **Step 3: Commit**

```bash
git add tests/conftest.py tests/fakes.py
git commit -m "test: add shared fixtures and SSH/provider fakes"
```

---

## Task 6: Connections router (CRUD)

**Files:**
- Create: `app/routers/connections.py`, `tests/test_connections.py`
- Modify: `app/main.py` (mount router — final form in Task 13; add interim mount now)

- [ ] **Step 1: Write the failing test**

`tests/test_connections.py`:
```python
def _payload(**over):
    base = dict(name="box-a", ip_address="10.0.0.1", user="root",
                ssh_key_path="/root/.ssh/id", gpu_type="A100-80GB",
                provider="local", privileged=True,
                capabilities=["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"])
    base.update(over)
    return base


def test_create_list_delete_connection(client):
    r = client.post("/api/v1/connections", json=_payload())
    assert r.status_code == 201
    body = r.json()
    cid = body["id"]
    assert "password" not in body and "ssh_key_path" not in body
    assert body["status"] == "idle"

    r = client.get("/api/v1/connections")
    assert r.status_code == 200
    assert any(c["id"] == cid for c in r.json())

    r = client.delete(f"/api/v1/connections/{cid}")
    assert r.status_code == 204

    r = client.delete(f"/api/v1/connections/{cid}")
    assert r.status_code == 404


def test_create_rejects_both_auth(client):
    r = client.post("/api/v1/connections", json=_payload(password="p"))
    assert r.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_connections.py -v`
Expected: FAIL — import error / 404 (router not mounted)

- [ ] **Step 3: Write the implementation**

`app/routers/connections.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import Connection
from ..schemas import ConnectionCreate, ConnectionRead

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("", response_model=list[ConnectionRead])
def list_connections(session: Session = Depends(get_session)):
    return session.exec(select(Connection)).all()


@router.post("", response_model=ConnectionRead, status_code=status.HTTP_201_CREATED)
def create_connection(payload: ConnectionCreate, session: Session = Depends(get_session)):
    conn = Connection(**payload.model_dump())
    session.add(conn)
    session.commit()
    session.refresh(conn)
    return conn


@router.delete("/{conn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(conn_id: str, session: Session = Depends(get_session)):
    conn = session.get(Connection, conn_id)
    if conn is None:
        raise HTTPException(status_code=404, detail="connection not found")
    session.delete(conn)
    session.commit()
```

Interim `app/main.py` (replaced in Task 13):
```python
from fastapi import FastAPI

from .db import init_db
from .routers import connections

app = FastAPI(title="agentBox")
app.include_router(connections.router, prefix="/api/v1")


@app.on_event("startup")
def _startup():
    init_db()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_connections.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/routers/connections.py app/main.py tests/test_connections.py
git commit -m "feat: connections CRUD endpoints"
```

---

## Task 7: Workspaces CRUD (list / create / get)

**Files:**
- Create: `app/routers/workspaces.py`, `tests/test_workspaces.py`
- Modify: `app/main.py` (mount workspaces router)

- [ ] **Step 1: Write the failing test**

`tests/test_workspaces.py`:
```python
def _ws(**over):
    base = dict(name="analyst", config_yaml="c.yaml", mcp_json="m.json",
                sqlite_db_path="./ctx.db", entrypoint="server.py")
    base.update(over)
    return base


def test_create_get_list_workspace(client):
    r = client.post("/api/v1/workspaces", json=_ws())
    assert r.status_code == 201
    wid = r.json()["id"]
    assert r.json()["status"] == "archived"

    r = client.get(f"/api/v1/workspaces/{wid}")
    assert r.status_code == 200
    assert r.json()["entrypoint"] == "server.py"

    r = client.get("/api/v1/workspaces")
    assert any(w["id"] == wid for w in r.json())


def test_get_missing_workspace_404(client):
    assert client.get("/api/v1/workspaces/nope").status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_workspaces.py -v`
Expected: FAIL — router not found / import error

- [ ] **Step 3: Write the implementation**

`app/routers/workspaces.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import Workspace
from ..schemas import WorkspaceCreate, WorkspaceRead

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _get_or_404(session: Session, ws_id: str) -> Workspace:
    ws = session.get(Workspace, ws_id)
    if ws is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    return ws


@router.get("", response_model=list[WorkspaceRead])
def list_workspaces(session: Session = Depends(get_session)):
    return session.exec(select(Workspace)).all()


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(payload: WorkspaceCreate, session: Session = Depends(get_session)):
    ws = Workspace(**payload.model_dump())
    session.add(ws)
    session.commit()
    session.refresh(ws)
    return ws


@router.get("/{ws_id}", response_model=WorkspaceRead)
def get_workspace(ws_id: str, session: Session = Depends(get_session)):
    return _get_or_404(session, ws_id)
```

Add to `app/main.py` imports and mounting:
```python
from .routers import connections, workspaces
# ...
app.include_router(workspaces.router, prefix="/api/v1")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_workspaces.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/routers/workspaces.py app/main.py tests/test_workspaces.py
git commit -m "feat: workspace CRUD endpoints"
```

---

## Task 8: SSH service

**Files:**
- Create: `app/services/ssh.py`, `tests/test_ssh.py`

- [ ] **Step 1: Write the failing test**

`tests/test_ssh.py`:
```python
from app.services.ssh import ParamikoSSHClient, SSHError
from app.models import Connection


def test_test_returns_false_on_unreachable_host():
    client = ParamikoSSHClient()
    conn = Connection(name="dead", ip_address="203.0.113.255", user="root",
                      password="x", port=22)
    # 203.0.113.0/24 is reserved (TEST-NET-3) → connect fails fast/timeout
    assert client.test(conn) is False


def test_run_raises_ssherror_on_unreachable_host():
    import pytest
    client = ParamikoSSHClient()
    conn = Connection(name="dead", ip_address="203.0.113.255", user="root",
                      password="x", port=22)
    with pytest.raises(SSHError):
        client.run(conn, "true")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ssh.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ssh'`

- [ ] **Step 3: Write the implementation**

`app/services/ssh.py`:
```python
import os
from typing import Protocol, runtime_checkable

import paramiko

from ..config import settings


class SSHError(Exception):
    pass


@runtime_checkable
class SSHClient(Protocol):
    def run(self, conn, command: str) -> tuple[int, str, str]: ...
    def push(self, conn, local_path: str, remote_dir: str) -> None: ...
    def pull(self, conn, remote_path: str, local_path: str) -> None: ...
    def test(self, conn) -> bool: ...


class ParamikoSSHClient:
    def _connect(self, conn) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kwargs = {
            "hostname": conn.ip_address,
            "port": conn.port,
            "username": conn.user,
            "timeout": settings.ssh_timeout,
        }
        if conn.ssh_key_path:
            kwargs["key_filename"] = conn.ssh_key_path
        else:
            kwargs["password"] = conn.password
        try:
            client.connect(**kwargs)
        except Exception as e:
            raise SSHError(f"SSH connect to {conn.ip_address} failed: {e}") from e
        return client

    def run(self, conn, command: str) -> tuple[int, str, str]:
        client = self._connect(conn)
        try:
            _, stdout, stderr = client.exec_command(command, timeout=settings.ssh_timeout)
            code = stdout.channel.recv_exit_status()
            return code, stdout.read().decode(), stderr.read().decode()
        finally:
            client.close()

    def push(self, conn, local_path: str, remote_dir: str) -> None:
        client = self._connect(conn)
        try:
            sftp = client.open_sftp()
            remote = remote_dir.rstrip("/") + "/" + os.path.basename(local_path)
            sftp.put(local_path, remote)
            sftp.close()
        except SSHError:
            raise
        except Exception as e:
            raise SSHError(f"SSH push failed: {e}") from e
        finally:
            client.close()

    def pull(self, conn, remote_path: str, local_path: str) -> None:
        client = self._connect(conn)
        try:
            os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
            sftp = client.open_sftp()
            sftp.get(remote_path, local_path)
            sftp.close()
        except SSHError:
            raise
        except Exception as e:
            raise SSHError(f"SSH pull failed: {e}") from e
        finally:
            client.close()

    def test(self, conn) -> bool:
        try:
            code, _, _ = self.run(conn, "true")
            return code == 0
        except SSHError:
            return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_ssh.py -v`
Expected: PASS (2 passed). Note: relies on a connect timeout; if the network blackholes the reserved range the timeout is `settings.ssh_timeout`.

- [ ] **Step 5: Commit**

```bash
git add app/services/ssh.py tests/test_ssh.py
git commit -m "feat: paramiko SSH client behind SSHClient protocol"
```

---

## Task 9: Provider service

**Files:**
- Create: `app/services/providers.py`, `tests/test_providers.py`

- [ ] **Step 1: Write the failing test**

`tests/test_providers.py`:
```python
from app.services.providers import resolve_provider, LocalProvider
from app.models import Connection, Provider


def test_resolve_local_provider_is_noop():
    conn = Connection(name="b", ip_address="1.1.1.1", user="root",
                      password="x", provider=Provider.local)
    p = resolve_provider(conn.provider)
    assert isinstance(p, LocalProvider)
    assert p.create_instance(conn) is None
    p.destroy_instance(conn)  # no raise


def test_resolve_runpod_and_vast():
    from app.services.providers import RunpodProvider, VastProvider
    assert isinstance(resolve_provider(Provider.runpod), RunpodProvider)
    assert isinstance(resolve_provider(Provider.vast), VastProvider)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_providers.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.providers'`

- [ ] **Step 3: Write the implementation**

`app/services/providers.py`:
```python
from typing import Protocol, runtime_checkable

from ..models import Provider


@runtime_checkable
class ComputeProvider(Protocol):
    def create_instance(self, conn) -> str | None: ...
    def destroy_instance(self, conn) -> None: ...


class LocalProvider:
    """Machine already exists; nothing to provision or destroy."""

    def create_instance(self, conn) -> str | None:
        return None

    def destroy_instance(self, conn) -> None:
        return None


class RunpodProvider:
    """STUB: real RunPod API integration is out of scope for the scaffold."""

    def create_instance(self, conn) -> str | None:
        return conn.provider_instance_id

    def destroy_instance(self, conn) -> None:
        return None


class VastProvider:
    """STUB: real Vast.ai API integration is out of scope for the scaffold."""

    def create_instance(self, conn) -> str | None:
        return conn.provider_instance_id

    def destroy_instance(self, conn) -> None:
        return None


def resolve_provider(provider: Provider) -> ComputeProvider:
    mapping = {
        Provider.local: LocalProvider,
        Provider.runpod: RunpodProvider,
        Provider.vast: VastProvider,
    }
    try:
        return mapping[provider]()
    except KeyError:  # pragma: no cover
        raise ValueError(f"unknown provider: {provider}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_providers.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/services/providers.py tests/test_providers.py
git commit -m "feat: compute provider stubs behind ComputeProvider protocol"
```

---

## Task 10: Compatibility service + deps + compatible-connections endpoint

**Files:**
- Create: `app/services/compat.py`, `app/deps.py`, `tests/test_compat.py`
- Modify: `app/routers/workspaces.py` (add `GET /{ws_id}/compatible-connections`)

- [ ] **Step 1: Write the failing test**

`tests/test_compat.py`:
```python
from app.services.compat import evaluate
from app.models import Connection, Workspace


def _priv_conn(**over):
    base = dict(name="b", ip_address="1.1.1.1", user="root", password="x",
                privileged=True,
                capabilities=["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"],
                driver_version="550.54.15", cuda_version="12.4",
                gpu_topology="1xA100-80GB-SXM")
    base.update(over)
    return Connection(**base)


def _ws(**over):
    base = dict(name="a", config_yaml="c", mcp_json="m",
                sqlite_db_path="d", entrypoint="e")
    base.update(over)
    return Workspace(**base)


def test_unprivileged_is_incompatible():
    res = evaluate(_ws(), _priv_conn(privileged=False))
    assert res.compatible is False
    assert any("privileged" in r for r in res.reasons)


def test_missing_caps_incompatible():
    res = evaluate(_ws(), _priv_conn(capabilities=["CAP_SYS_ADMIN"]))
    assert res.compatible is False
    assert any("CAP_CHECKPOINT_RESTORE" in r for r in res.reasons)


def test_never_frozen_skips_profile_match():
    res = evaluate(_ws(), _priv_conn())
    assert res.compatible is True


def test_frozen_profile_exact_match_required():
    ws = _ws(frozen_profile={"driver_version": "535.x", "cuda_version": "12.4",
                             "gpu_topology": "1xA100-80GB-SXM"})
    res = evaluate(ws, _priv_conn())  # driver 550 != 535
    assert res.compatible is False
    assert any("driver_version" in r for r in res.reasons)


def test_frozen_profile_exact_match_passes():
    profile = {"driver_version": "550.54.15", "cuda_version": "12.4",
               "gpu_topology": "1xA100-80GB-SXM"}
    res = evaluate(_ws(frozen_profile=profile), _priv_conn())
    assert res.compatible is True
```

`tests/test_compatible_connections.py`:
```python
def _conn(client, **over):
    base = dict(name="m", ip_address="10.0.0.9", user="root", ssh_key_path="/k",
                provider="local", privileged=True,
                capabilities=["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"])
    base.update(over)
    return client.post("/api/v1/connections", json=base).json()


def _ws(client):
    return client.post("/api/v1/workspaces", json=dict(
        name="a", config_yaml="c.yaml", mcp_json="m.json",
        sqlite_db_path="./ctx.db", entrypoint="server.py")).json()


def test_compatible_connections_lists_reasons(client):
    good = _conn(client)
    bad = _conn(client, privileged=False)
    ws = _ws(client)
    r = client.get(f"/api/v1/workspaces/{ws['id']}/compatible-connections")
    assert r.status_code == 200
    by_id = {row["connection"]["id"]: row for row in r.json()}
    assert by_id[good["id"]]["compatible"] is True
    assert by_id[bad["id"]]["compatible"] is False
    assert by_id[bad["id"]]["reasons"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_compat.py tests/test_compatible_connections.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.compat'`

- [ ] **Step 3: Write the implementation**

`app/services/compat.py`:
```python
from dataclasses import dataclass

from ..config import settings


@dataclass
class CompatResult:
    compatible: bool
    reasons: list[str]


def evaluate(workspace, connection) -> CompatResult:
    reasons: list[str] = []

    if not connection.privileged:
        reasons.append("connection is not privileged (CRIU requires a privileged container)")

    caps = connection.capabilities or []
    missing = [c for c in settings.required_caps if c not in caps]
    if missing:
        reasons.append(f"connection missing capabilities: {', '.join(missing)}")

    profile = workspace.frozen_profile
    if profile:
        for key in ("driver_version", "cuda_version", "gpu_topology"):
            want = profile.get(key)
            got = getattr(connection, key)
            if want != got:
                reasons.append(f"{key} mismatch: frozen {want} != connection {got}")

    return CompatResult(compatible=not reasons, reasons=reasons)
```

`app/deps.py`:
```python
from .services.ssh import ParamikoSSHClient, SSHClient
from .services.providers import resolve_provider


def get_ssh() -> SSHClient:
    return ParamikoSSHClient()


def get_provider_resolver():
    return resolve_provider
```

Add to `app/routers/workspaces.py`:
```python
from ..models import Connection
from ..services.compat import evaluate as evaluate_compat
from ..schemas import ConnectionRead


@router.get("/{ws_id}/compatible-connections")
def compatible_connections(ws_id: str, session: Session = Depends(get_session)):
    ws = _get_or_404(session, ws_id)
    rows = []
    for conn in session.exec(select(Connection)).all():
        res = evaluate_compat(ws, conn)
        rows.append({
            "connection": ConnectionRead.model_validate(conn).model_dump(mode="json"),
            "compatible": res.compatible,
            "reasons": res.reasons,
        })
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_compat.py tests/test_compatible_connections.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add app/services/compat.py app/deps.py app/routers/workspaces.py tests/test_compat.py tests/test_compatible_connections.py
git commit -m "feat: compatibility gate + compatible-connections endpoint"
```

---

## Task 11: Checkpoint freeze pipeline

**Files:**
- Create: `app/services/checkpoint.py`, `tests/test_checkpoint.py`

- [ ] **Step 1: Write the failing test**

`tests/test_checkpoint.py`:
```python
from app.services.checkpoint import freeze_workspace
from app.models import Connection, Workspace
from tests.fakes import FakeSSH, FakeProvider


def _conn():
    return Connection(name="b", ip_address="1.1.1.1", user="root", password="x",
                      provider_instance_id="rp-123")


def _ws():
    return Workspace(name="a", config_yaml="c", mcp_json="m",
                     sqlite_db_path="d", entrypoint="e")


def test_freeze_runs_four_steps_in_order(tmp_path):
    ssh, prov = FakeSSH(), FakeProvider()
    report = freeze_workspace(_ws(), _conn(), ssh, prov, str(tmp_path))
    assert report.success is True
    assert report.steps_completed == [
        "lock_cuda_api", "cuda_checkpoint_dump", "criu_dump", "teardown_and_pull",
    ]
    assert report.artifact_path and report.artifact_path.endswith(".tar")
    assert prov.destroyed == [_conn().id] or len(prov.destroyed) == 1
    assert report.size_gb >= 0.0


def test_freeze_reports_failed_step():
    class BoomSSH(FakeSSH):
        def run(self, conn, command):
            if "criu dump" in command:
                from app.services.ssh import SSHError
                raise SSHError("criu blew up")
            return super().run(conn, command)

    report = freeze_workspace(_ws(), _conn(), BoomSSH(), FakeProvider(), "local/artifacts")
    assert report.success is False
    assert report.last_step == "criu_dump"
    assert "criu blew up" in report.error
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_checkpoint.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.checkpoint'`

- [ ] **Step 3: Write the implementation**

`app/services/checkpoint.py`:
```python
import os
from dataclasses import dataclass, field


@dataclass
class FreezeReport:
    steps_completed: list[str] = field(default_factory=list)
    last_step: str | None = None
    artifact_path: str | None = None
    size_gb: float = 0.0
    success: bool = False
    error: str | None = None


def _remote_dir(ws) -> str:
    return f"~/agentbox/{ws.id}"


def _lock_cuda_api(ws, conn, ssh, provider, artifact_dir, report):
    # STUB: real impl toggles the CUDA API lock so no new work is submitted.
    ssh.run(conn, "cuda-checkpoint --toggle --pid 1  # STUB lock cuda api")


def _cuda_checkpoint_dump(ws, conn, ssh, provider, artifact_dir, report):
    # STUB: real impl copies VRAM -> host RAM via cuda-checkpoint.
    ssh.run(conn, f"cuda-checkpoint --dump --pid 1 --dir {_remote_dir(ws)}  # STUB vram dump")


def _criu_dump(ws, conn, ssh, provider, artifact_dir, report):
    # STUB: real impl runs `criu dump` for the container's process tree.
    ssh.run(conn, f"criu dump -t 1 -D {_remote_dir(ws)}/dump  # STUB criu dump")


def _teardown_and_pull(ws, conn, ssh, provider, artifact_dir, report):
    remote_tar = f"~/agentbox/{ws.id}.tar"
    ssh.run(conn, f"tar -czf {remote_tar} -C {_remote_dir(ws)} .")
    os.makedirs(artifact_dir, exist_ok=True)
    local_path = os.path.join(artifact_dir, f"{ws.id}.tar")
    ssh.pull(conn, remote_tar, local_path)
    provider.destroy_instance(conn)
    report.artifact_path = local_path
    if os.path.exists(local_path):
        report.size_gb = round(os.path.getsize(local_path) / 1e9, 6)


_STEPS = [
    ("lock_cuda_api", _lock_cuda_api),
    ("cuda_checkpoint_dump", _cuda_checkpoint_dump),
    ("criu_dump", _criu_dump),
    ("teardown_and_pull", _teardown_and_pull),
]


def freeze_workspace(workspace, connection, ssh, provider, artifact_dir) -> FreezeReport:
    report = FreezeReport()
    for name, fn in _STEPS:
        report.last_step = name
        try:
            fn(workspace, connection, ssh, provider, artifact_dir, report)
        except Exception as e:  # noqa: BLE001 — surface the failing step to the caller
            report.error = str(e)
            return report
        report.steps_completed.append(name)
    report.success = True
    return report
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_checkpoint.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/services/checkpoint.py tests/test_checkpoint.py
git commit -m "feat: 4-step freeze pipeline with step-level failure reporting"
```

---

## Task 12: Deploy service

**Files:**
- Create: `app/services/deploy.py`, `tests/test_deploy_service.py`

- [ ] **Step 1: Write the failing test**

`tests/test_deploy_service.py`:
```python
from app.services.deploy import deploy_workspace
from app.models import Connection, Workspace
from tests.fakes import FakeSSH, FakeProvider


def _conn():
    return Connection(name="b", ip_address="1.1.1.1", user="root", password="x",
                      capabilities=["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"])


def test_deploy_fresh_workspace_bootstraps_container():
    ssh, prov = FakeSSH(), FakeProvider()
    ws = Workspace(name="a", config_yaml="c.yaml", mcp_json="m.json",
                   sqlite_db_path="ctx.db", entrypoint="server.py")
    deploy_workspace(ws, _conn(), ssh, prov)
    assert prov.created  # provider create called
    # mkdir + docker run + entrypoint exec issued
    joined = "\n".join(ssh.commands)
    assert "mkdir -p" in joined
    assert "docker run -d --privileged" in joined
    assert "--cap-add=CAP_CHECKPOINT_RESTORE" in joined
    assert "python server.py" in joined
    # all four bundle files pushed
    assert len(ssh.pushes) == 4


def test_deploy_with_artifact_pushes_tar_and_restores():
    ssh, prov = FakeSSH(), FakeProvider()
    ws = Workspace(name="a", config_yaml="c.yaml", mcp_json="m.json",
                   sqlite_db_path="ctx.db", entrypoint="server.py",
                   artifact_path="local/artifacts/x.tar")
    deploy_workspace(ws, _conn(), ssh, prov)
    assert len(ssh.pushes) == 5  # 4 bundle + 1 artifact
    assert any("criu restore" in c for c in ssh.commands)
    assert not any("python server.py" in c for c in ssh.commands)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_deploy_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.deploy'`

- [ ] **Step 3: Write the implementation**

`app/services/deploy.py`:
```python
def _remote_dir(ws) -> str:
    return f"~/agentbox/{ws.id}"


def deploy_workspace(workspace, connection, ssh, provider) -> None:
    """Push the bundle and bootstrap a privileged container (agent = PID 1).

    Bundle fields are treated as local file paths (scaffold assumption).
    """
    provider.create_instance(connection)

    remote_dir = _remote_dir(workspace)
    ssh.run(connection, f"mkdir -p {remote_dir}")

    bundle = [
        workspace.config_yaml,
        workspace.mcp_json,
        workspace.sqlite_db_path,
        workspace.entrypoint,
    ]
    for path in bundle:
        ssh.push(connection, path, remote_dir)
    if workspace.artifact_path:
        ssh.push(connection, workspace.artifact_path, remote_dir)

    caps = " ".join(f"--cap-add={c}" for c in (connection.capabilities or []))
    container = f"agentbox-{workspace.id}"
    ssh.run(
        connection,
        f"docker run -d --privileged {caps} --name {container} "
        f"-v {remote_dir}:/workspace -w /workspace agentbox-runtime",
    )

    if workspace.artifact_path:
        # STUB: real impl runs `criu restore` inside the container (PID 1 preserved).
        ssh.run(connection, f"docker exec {container} criu restore -d -D /workspace/dump  # STUB restore")
    else:
        ssh.run(connection, f"docker exec {container} python {workspace.entrypoint}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_deploy_service.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add app/services/deploy.py tests/test_deploy_service.py
git commit -m "feat: deploy orchestration (push bundle + bootstrap container)"
```

---

## Task 13: Deploy + freeze endpoints and final app wiring

**Files:**
- Modify: `app/routers/workspaces.py` (add deploy + freeze endpoints)
- Modify: `app/main.py` (lifespan + both routers, final form)
- Create: `tests/test_deploy_freeze_endpoints.py`, `README.md`

- [ ] **Step 1: Write the failing test**

`tests/test_deploy_freeze_endpoints.py`:
```python
import os


def _conn(client, **over):
    base = dict(name="m", ip_address="10.0.0.9", user="root", ssh_key_path="/k",
                provider="local", privileged=True, provider_instance_id="rp-1",
                driver_version="550.54.15", cuda_version="12.4",
                gpu_topology="1xA100-80GB-SXM",
                capabilities=["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"])
    base.update(over)
    return client.post("/api/v1/connections", json=base).json()


def _ws(client):
    return client.post("/api/v1/workspaces", json=dict(
        name="a", config_yaml="c.yaml", mcp_json="m.json",
        sqlite_db_path="./ctx.db", entrypoint="server.py")).json()


def test_deploy_then_freeze_roundtrip(client, fake_provider, tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.artifact_dir", str(tmp_path))
    conn = _conn(client)
    ws = _ws(client)

    r = client.post(f"/api/v1/workspaces/{ws['id']}/deploy",
                    json={"connection_id": conn["id"]})
    assert r.status_code == 200
    assert r.json()["status"] == "running"
    assert r.json()["active_connection_id"] == conn["id"]
    # connection now in_use
    conns = {c["id"]: c for c in client.get("/api/v1/connections").json()}
    assert conns[conn["id"]]["status"] == "in_use"

    r = client.post(f"/api/v1/workspaces/{ws['id']}/freeze")
    assert r.status_code == 200
    body = r.json()
    assert body["workspace"]["status"] == "archived"
    assert body["workspace"]["active_connection_id"] is None
    assert body["workspace"]["frozen_profile"]["driver_version"] == "550.54.15"
    assert body["freeze_report"]["success"] is True
    assert fake_provider.destroyed == [conn["id"]]
    conns = {c["id"]: c for c in client.get("/api/v1/connections").json()}
    assert conns[conn["id"]]["status"] == "idle"


def test_deploy_to_incompatible_connection_409(client):
    conn = _conn(client, privileged=False)
    ws = _ws(client)
    r = client.post(f"/api/v1/workspaces/{ws['id']}/deploy",
                    json={"connection_id": conn["id"]})
    assert r.status_code == 409
    assert "privileged" in r.json()["detail"]


def test_deploy_busy_connection_409(client):
    conn = _conn(client)
    ws1, ws2 = _ws(client), _ws(client)
    client.post(f"/api/v1/workspaces/{ws1['id']}/deploy", json={"connection_id": conn["id"]})
    r = client.post(f"/api/v1/workspaces/{ws2['id']}/deploy", json={"connection_id": conn["id"]})
    assert r.status_code == 409


def test_freeze_non_running_409(client):
    ws = _ws(client)
    r = client.post(f"/api/v1/workspaces/{ws['id']}/freeze")
    assert r.status_code == 409


def test_deploy_unknown_connection_404(client):
    ws = _ws(client)
    r = client.post(f"/api/v1/workspaces/{ws['id']}/deploy", json={"connection_id": "nope"})
    assert r.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_deploy_freeze_endpoints.py -v`
Expected: FAIL — deploy/freeze routes return 404/405 (not implemented)

- [ ] **Step 3: Write the implementation**

Append to `app/routers/workspaces.py` (imports at top of file):
```python
from datetime import datetime, timezone

from ..config import settings
from ..models import ConnStatus, WsStatus
from ..schemas import DeployRequest
from ..services.compat import evaluate as evaluate_compat
from ..services.deploy import deploy_workspace
from ..services.checkpoint import freeze_workspace
from ..services.ssh import SSHError
from ..deps import get_ssh, get_provider_resolver
```

```python
@router.post("/{ws_id}/deploy", response_model=WorkspaceRead)
def deploy(ws_id: str, body: DeployRequest,
           session: Session = Depends(get_session),
           ssh=Depends(get_ssh),
           provider_resolver=Depends(get_provider_resolver)):
    ws = _get_or_404(session, ws_id)
    conn = session.get(Connection, body.connection_id)
    if conn is None:
        raise HTTPException(status_code=404, detail="connection not found")
    if ws.status != WsStatus.archived:
        raise HTTPException(status_code=409, detail="workspace is not archived")
    if conn.status != ConnStatus.idle:
        raise HTTPException(status_code=409, detail="connection is not idle")
    compat = evaluate_compat(ws, conn)
    if not compat.compatible:
        raise HTTPException(status_code=409, detail="; ".join(compat.reasons))

    provider = provider_resolver(conn.provider)
    try:
        deploy_workspace(ws, conn, ssh, provider)
    except SSHError as e:
        raise HTTPException(status_code=502, detail=f"deploy failed: {e}")

    ws.status = WsStatus.running
    ws.active_connection_id = conn.id
    conn.status = ConnStatus.in_use
    conn.last_connected = datetime.now(timezone.utc)
    session.add(ws)
    session.add(conn)
    session.commit()
    session.refresh(ws)
    return ws


@router.post("/{ws_id}/freeze")
def freeze(ws_id: str,
           session: Session = Depends(get_session),
           ssh=Depends(get_ssh),
           provider_resolver=Depends(get_provider_resolver)):
    ws = _get_or_404(session, ws_id)
    if ws.status != WsStatus.running:
        raise HTTPException(status_code=409, detail="workspace is not running")
    conn = session.get(Connection, ws.active_connection_id)
    if conn is None:
        raise HTTPException(status_code=409, detail="active connection missing")

    provider = provider_resolver(conn.provider)
    report = freeze_workspace(ws, conn, ssh, provider, settings.artifact_dir)
    if not report.success:
        raise HTTPException(
            status_code=502,
            detail=f"freeze failed at step '{report.last_step}': {report.error}",
        )

    ws.status = WsStatus.archived
    ws.active_connection_id = None
    ws.artifact_path = report.artifact_path
    ws.size_gb = report.size_gb
    ws.frozen_profile = {
        "driver_version": conn.driver_version,
        "cuda_version": conn.cuda_version,
        "gpu_topology": conn.gpu_topology,
    }
    conn.status = ConnStatus.idle
    session.add(ws)
    session.add(conn)
    session.commit()
    session.refresh(ws)
    return {
        "workspace": WorkspaceRead.model_validate(ws).model_dump(mode="json"),
        "freeze_report": {
            "success": report.success,
            "steps_completed": report.steps_completed,
            "last_step": report.last_step,
            "artifact_path": report.artifact_path,
            "size_gb": report.size_gb,
        },
    }
```

Final `app/main.py`:
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import init_db
from .routers import connections, workspaces


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="agentBox", version="0.1.0", lifespan=lifespan)
app.include_router(connections.router, prefix="/api/v1")
app.include_router(workspaces.router, prefix="/api/v1")
```

`README.md`:
```markdown
# agentBox backend

FastAPI backend that manages SSH-reachable GPU machines (Connections) and portable
agent environments (Workspaces), automating the CRIU/cuda-checkpoint deploy/freeze
dance. SSH is real (paramiko); checkpoint internals and cloud-provider APIs are stubbed
behind interfaces.

## Run
```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload
# docs at http://127.0.0.1:8000/docs
```

## Test
```bash
pytest -v
```

## Scaffold assumptions
- Deploy treats `config_yaml`, `mcp_json`, `sqlite_db_path`, `entrypoint` as **file paths** to push.
- Target hosts have a reachable **Docker daemon**; the agent runs as **PID 1** in a privileged container.
- Checkpoint steps 1–3 (`lock_cuda_api`, `cuda_checkpoint_dump`, `criu_dump`) and provider
  create/destroy are **stubs** that issue placeholder SSH commands / no-ops. Step 4
  (`tar` + `scp` pull) uses real SSH.
- Secrets (`password`, `ssh_key_path`) are stored plaintext in SQLite and excluded from responses; no encryption at rest, no API auth.
- Compatibility is **exact-match** on driver/cuda/topology plus a privilege/capabilities check.
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `pytest -v`
Expected: PASS (all tests across all files green)

- [ ] **Step 5: Commit**

```bash
git add app/routers/workspaces.py app/main.py tests/test_deploy_freeze_endpoints.py README.md
git commit -m "feat: deploy/freeze endpoints, state machine, and app wiring"
```

---

## Self-Review Notes

**Spec coverage:** Connections CRUD (T6) ✓; Workspaces CRUD (T7) ✓; compatibility profile fields on Connection (T3) ✓; frozen_profile/artifact on Workspace (T3) ✓; compatibility gate real (T10) ✓; compatible-connections endpoint (T10) ✓; container bootstrap + PID-1 (T12) ✓; 4-step freeze dance with partial-failure report (T11) ✓; provider lifecycle behind interface (T9) ✓; real SSH/paramiko (T8) ✓; secrets excluded from responses (T4) ✓; key/password XOR (T4) ✓; error codes 404/409/422/502 (T6, T13) ✓; faked-SSH tests (T5, T11–13) ✓.

**Type consistency:** `evaluate(workspace, connection) -> CompatResult` used identically in T10 and T13. `freeze_workspace(workspace, connection, ssh, provider, artifact_dir) -> FreezeReport` consistent T11/T13. `deploy_workspace(workspace, connection, ssh, provider)` consistent T12/T13. `get_ssh` / `get_provider_resolver` defined in T10, overridden in T5, consumed in T13. Enum names (`ConnStatus`, `WsStatus`, `Provider`) consistent across T3–T13.

**Note:** `app/main.py` is written minimally in T1, gains connections in T6, workspaces in T7, and reaches final lifespan form in T13 — each task's version is shown in full to avoid placeholder drift.
