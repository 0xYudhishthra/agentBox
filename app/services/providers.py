from typing import Protocol, runtime_checkable

from ..models import Provider


@runtime_checkable
class ComputeProvider(Protocol):
    def create_instance(self, conn) -> str | None: ...
    def destroy_instance(self, conn) -> None: ...


class LocalProvider:
    """Machine already exists; nothing to provision or destroy."""

    def create_instance(self, conn) -> str | None:
        return None

    def destroy_instance(self, conn) -> None:
        return None


class RunpodProvider:
    """STUB: real RunPod API integration is out of scope for the scaffold."""

    def create_instance(self, conn) -> str | None:
        return conn.provider_instance_id

    def destroy_instance(self, conn) -> None:
        return None


class VastProvider:
    """STUB: real Vast.ai API integration is out of scope for the scaffold."""

    def create_instance(self, conn) -> str | None:
        return conn.provider_instance_id

    def destroy_instance(self, conn) -> None:
        return None


def resolve_provider(provider: Provider) -> ComputeProvider:
    mapping = {
        Provider.local: LocalProvider,
        Provider.runpod: RunpodProvider,
        Provider.vast: VastProvider,
    }
    try:
        return mapping[provider]()
    except KeyError:  # pragma: no cover
        raise ValueError(f"unknown provider: {provider}")
