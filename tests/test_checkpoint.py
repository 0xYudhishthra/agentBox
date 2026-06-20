from app.services.checkpoint import freeze_workspace
from app.models import Connection, Workspace
from tests.fakes import FakeSSH, FakeProvider


def _conn():
    return Connection(name="b", ip_address="1.1.1.1", user="root", password="x",
                      provider_instance_id="rp-123")


def _ws():
    return Workspace(name="a", config_yaml="c", mcp_json="m",
                     sqlite_db_path="d", entrypoint="e")


def test_freeze_runs_four_steps_in_order(tmp_path):
    ssh, prov = FakeSSH(), FakeProvider()
    report = freeze_workspace(_ws(), _conn(), ssh, prov, str(tmp_path))
    assert report.success is True
    assert report.steps_completed == [
        "lock_cuda_api", "cuda_checkpoint_dump", "criu_dump", "teardown_and_pull",
    ]
    assert report.artifact_path and report.artifact_path.endswith(".tar")
    assert prov.destroyed == [_conn().id] or len(prov.destroyed) == 1
    assert report.size_gb >= 0.0


def test_freeze_reports_failed_step():
    class BoomSSH(FakeSSH):
        def run(self, conn, command):
            if "criu dump" in command:
                from app.services.ssh import SSHError
                raise SSHError("criu blew up")
            return super().run(conn, command)

    report = freeze_workspace(_ws(), _conn(), BoomSSH(), FakeProvider(), "local/artifacts")
    assert report.success is False
    assert report.last_step == "criu_dump"
    assert "criu blew up" in report.error
