from .services.ssh import ParamikoSSHClient, SSHClient
from .services.providers import resolve_provider


def get_ssh() -> SSHClient:
    return ParamikoSSHClient()


def get_provider_resolver():
    return resolve_provider
