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
