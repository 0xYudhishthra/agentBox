from app.services.providers import resolve_provider, LocalProvider
from app.models import Connection, Provider


def test_resolve_local_provider_is_noop():
    conn = Connection(name="b", ip_address="1.1.1.1", user="root",
                      password="x", provider=Provider.local)
    p = resolve_provider(conn.provider)
    assert isinstance(p, LocalProvider)
    assert p.create_instance(conn) is None
    p.destroy_instance(conn)  # no raise


def test_resolve_runpod_and_vast():
    from app.services.providers import RunpodProvider, VastProvider
    assert isinstance(resolve_provider(Provider.runpod), RunpodProvider)
    assert isinstance(resolve_provider(Provider.vast), VastProvider)
