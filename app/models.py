import uuid
from datetime import datetime
from enum import Enum
from typing import Any

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
    frozen_profile: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
