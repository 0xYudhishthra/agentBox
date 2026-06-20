from dataclasses import dataclass

from ..config import settings


@dataclass
class CompatResult:
    compatible: bool
    reasons: list[str]


def evaluate(workspace, connection) -> CompatResult:
    reasons: list[str] = []

    if not connection.privileged:
        reasons.append("connection is not privileged (CRIU requires a privileged container)")

    caps = connection.capabilities or []
    missing = [c for c in settings.required_caps if c not in caps]
    if missing:
        reasons.append(f"connection missing capabilities: {', '.join(missing)}")

    profile = workspace.frozen_profile
    if profile:
        for key in ("driver_version", "cuda_version", "gpu_topology"):
            want = profile.get(key)
            got = getattr(connection, key)
            if want != got:
                reasons.append(f"{key} mismatch: frozen {want} != connection {got}")

    return CompatResult(compatible=not reasons, reasons=reasons)
