from app.services.compat import evaluate
from app.models import Connection, Workspace


def _priv_conn(**over):
    base = dict(name="b", ip_address="1.1.1.1", user="root", password="x",
                privileged=True,
                capabilities=["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"],
                driver_version="550.54.15", cuda_version="12.4",
                gpu_topology="1xA100-80GB-SXM")
    base.update(over)
    return Connection(**base)


def _ws(**over):
    base = dict(name="a", config_yaml="c", mcp_json="m",
                sqlite_db_path="d", entrypoint="e")
    base.update(over)
    return Workspace(**base)


def test_unprivileged_is_incompatible():
    res = evaluate(_ws(), _priv_conn(privileged=False))
    assert res.compatible is False
    assert any("privileged" in r for r in res.reasons)


def test_missing_caps_incompatible():
    res = evaluate(_ws(), _priv_conn(capabilities=["CAP_SYS_ADMIN"]))
    assert res.compatible is False
    assert any("CAP_CHECKPOINT_RESTORE" in r for r in res.reasons)


def test_never_frozen_skips_profile_match():
    res = evaluate(_ws(), _priv_conn())
    assert res.compatible is True


def test_frozen_profile_exact_match_required():
    ws = _ws(frozen_profile={"driver_version": "535.x", "cuda_version": "12.4",
                             "gpu_topology": "1xA100-80GB-SXM"})
    res = evaluate(ws, _priv_conn())  # driver 550 != 535
    assert res.compatible is False
    assert any("driver_version" in r for r in res.reasons)


def test_frozen_profile_exact_match_passes():
    profile = {"driver_version": "550.54.15", "cuda_version": "12.4",
               "gpu_topology": "1xA100-80GB-SXM"}
    res = evaluate(_ws(frozen_profile=profile), _priv_conn())
    assert res.compatible is True
