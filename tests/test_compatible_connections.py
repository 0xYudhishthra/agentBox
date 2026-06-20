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
