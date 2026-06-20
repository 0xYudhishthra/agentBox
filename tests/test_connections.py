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
