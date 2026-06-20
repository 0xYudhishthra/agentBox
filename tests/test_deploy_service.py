from app.services.deploy import deploy_workspace
from app.models import Connection, Workspace
from tests.fakes import FakeSSH, FakeProvider


def _conn():
    return Connection(name="b", ip_address="1.1.1.1", user="root", password="x",
                      capabilities=["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"])


def test_deploy_fresh_workspace_bootstraps_container():
    ssh, prov = FakeSSH(), FakeProvider()
    ws = Workspace(name="a", config_yaml="c.yaml", mcp_json="m.json",
                   sqlite_db_path="ctx.db", entrypoint="server.py")
    deploy_workspace(ws, _conn(), ssh, prov)
    assert prov.created  # provider create called
    # mkdir + docker run + entrypoint exec issued
    joined = "\n".join(ssh.commands)
    assert "mkdir -p" in joined
    assert "docker run -d --privileged" in joined
    assert "--cap-add=CAP_CHECKPOINT_RESTORE" in joined
    assert "python server.py" in joined
    # all four bundle files pushed
    assert len(ssh.pushes) == 4


def test_deploy_with_artifact_pushes_tar_and_restores():
    ssh, prov = FakeSSH(), FakeProvider()
    ws = Workspace(name="a", config_yaml="c.yaml", mcp_json="m.json",
                   sqlite_db_path="ctx.db", entrypoint="server.py",
                   artifact_path="local/artifacts/x.tar")
    deploy_workspace(ws, _conn(), ssh, prov)
    assert len(ssh.pushes) == 5  # 4 bundle + 1 artifact
    assert any("criu restore" in c for c in ssh.commands)
    assert not any("python server.py" in c for c in ssh.commands)
