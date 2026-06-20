from app.services.ssh import ParamikoSSHClient, SSHError
from app.models import Connection


def test_test_returns_false_on_unreachable_host():
    client = ParamikoSSHClient()
    conn = Connection(name="dead", ip_address="203.0.113.255", user="root",
                      password="x", port=22)
    # 203.0.113.0/24 is reserved (TEST-NET-3) → connect fails fast/timeout
    assert client.test(conn) is False


def test_run_raises_ssherror_on_unreachable_host():
    import pytest
    client = ParamikoSSHClient()
    conn = Connection(name="dead", ip_address="203.0.113.255", user="root",
                      password="x", port=22)
    with pytest.raises(SSHError):
        client.run(conn, "true")
