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
