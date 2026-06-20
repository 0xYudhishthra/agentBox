from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import Connection, ConnStatus, Workspace, WsStatus
from ..schemas import ConnectionRead, DeployRequest, WorkspaceCreate, WorkspaceRead
from ..services.compat import evaluate as evaluate_compat
from ..services.deploy import deploy_workspace
from ..services.checkpoint import freeze_workspace
from ..services.ssh import SSHError
from ..deps import get_ssh, get_provider_resolver

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
