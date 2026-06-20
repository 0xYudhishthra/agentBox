import os
from dataclasses import dataclass, field


@dataclass
class FreezeReport:
    steps_completed: list[str] = field(default_factory=list)
    last_step: str | None = None
    artifact_path: str | None = None
    size_gb: float = 0.0
    success: bool = False
    error: str | None = None


def _remote_dir(ws) -> str:
    return f"~/agentbox/{ws.id}"


def _lock_cuda_api(ws, conn, ssh, provider, artifact_dir, report):
    # STUB: real impl toggles the CUDA API lock so no new work is submitted.
    ssh.run(conn, "cuda-checkpoint --toggle --pid 1  # STUB lock cuda api")


def _cuda_checkpoint_dump(ws, conn, ssh, provider, artifact_dir, report):
    # STUB: real impl copies VRAM -> host RAM via cuda-checkpoint.
    ssh.run(conn, f"cuda-checkpoint --dump --pid 1 --dir {_remote_dir(ws)}  # STUB vram dump")


def _criu_dump(ws, conn, ssh, provider, artifact_dir, report):
    # STUB: real impl runs `criu dump` for the container's process tree.
    ssh.run(conn, f"criu dump -t 1 -D {_remote_dir(ws)}/dump  # STUB criu dump")


def _teardown_and_pull(ws, conn, ssh, provider, artifact_dir, report):
    remote_tar = f"~/agentbox/{ws.id}.tar"
    ssh.run(conn, f"tar -czf {remote_tar} -C {_remote_dir(ws)} .")
    os.makedirs(artifact_dir, exist_ok=True)
    local_path = os.path.join(artifact_dir, f"{ws.id}.tar")
    ssh.pull(conn, remote_tar, local_path)
    provider.destroy_instance(conn)
    report.artifact_path = local_path
    if os.path.exists(local_path):
        report.size_gb = round(os.path.getsize(local_path) / 1e9, 6)


_STEPS = [
    ("lock_cuda_api", _lock_cuda_api),
    ("cuda_checkpoint_dump", _cuda_checkpoint_dump),
    ("criu_dump", _criu_dump),
    ("teardown_and_pull", _teardown_and_pull),
]


def freeze_workspace(workspace, connection, ssh, provider, artifact_dir) -> FreezeReport:
    report = FreezeReport()
    for name, fn in _STEPS:
        report.last_step = name
        try:
            fn(workspace, connection, ssh, provider, artifact_dir, report)
        except Exception as e:  # noqa: BLE001 — surface the failing step to the caller
            report.error = str(e)
            return report
        report.steps_completed.append(name)
    report.success = True
    return report
