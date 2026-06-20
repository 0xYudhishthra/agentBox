import os
from typing import Protocol, runtime_checkable

import paramiko

from ..config import settings


class SSHError(Exception):
    pass


@runtime_checkable
class SSHClient(Protocol):
    def run(self, conn, command: str) -> tuple[int, str, str]: ...
    def push(self, conn, local_path: str, remote_dir: str) -> None: ...
    def pull(self, conn, remote_path: str, local_path: str) -> None: ...
    def test(self, conn) -> bool: ...


class ParamikoSSHClient:
    def _connect(self, conn) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kwargs = {
            "hostname": conn.ip_address,
            "port": conn.port,
            "username": conn.user,
            "timeout": settings.ssh_timeout,
        }
        if conn.ssh_key_path:
            kwargs["key_filename"] = conn.ssh_key_path
        else:
            kwargs["password"] = conn.password
        try:
            client.connect(**kwargs)
        except Exception as e:
            raise SSHError(f"SSH connect to {conn.ip_address} failed: {e}") from e
        return client

    def run(self, conn, command: str) -> tuple[int, str, str]:
        client = self._connect(conn)
        try:
            _, stdout, stderr = client.exec_command(command, timeout=settings.ssh_timeout)
            code = stdout.channel.recv_exit_status()
            return code, stdout.read().decode(), stderr.read().decode()
        finally:
            client.close()

    def push(self, conn, local_path: str, remote_dir: str) -> None:
        client = self._connect(conn)
        try:
            sftp = client.open_sftp()
            remote = remote_dir.rstrip("/") + "/" + os.path.basename(local_path)
            sftp.put(local_path, remote)
            sftp.close()
        except SSHError:
            raise
        except Exception as e:
            raise SSHError(f"SSH push failed: {e}") from e
        finally:
            client.close()

    def pull(self, conn, remote_path: str, local_path: str) -> None:
        client = self._connect(conn)
        try:
            os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
            sftp = client.open_sftp()
            sftp.get(remote_path, local_path)
            sftp.close()
        except SSHError:
            raise
        except Exception as e:
            raise SSHError(f"SSH pull failed: {e}") from e
        finally:
            client.close()

    def test(self, conn) -> bool:
        try:
            code, _, _ = self.run(conn, "true")
            return code == 0
        except SSHError:
            return False
