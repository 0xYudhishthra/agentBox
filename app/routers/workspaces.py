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
