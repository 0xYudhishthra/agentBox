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
