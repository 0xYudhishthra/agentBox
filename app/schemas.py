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
    ssh_key_path: str | None
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
