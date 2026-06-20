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
