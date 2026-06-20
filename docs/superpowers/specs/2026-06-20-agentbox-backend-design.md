# agentBox Backend — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm) → ready for implementation plan

## Purpose

A local (or lightweight-cloud) backend that manages the state for a CLI tool that
orchestrates portable AI-agent workloads across rented/owned GPU machines. It exposes
a RESTful API under `/api/v1` for two resources:

- **Connections** — the raw compute (bare-metal, rented GPUs, local machines) reachable over SSH.
- **Workspaces** — bundled agent environments and their frozen (checkpointed) state.

The backend automates the deeply technical "checkpoint / restore" dance (CRIU +
NVIDIA `cuda-checkpoint`) over SSH, plus the provider (RunPod / Vast) rent-and-destroy
lifecycle. In this scaffold, **SSH and provider/CRIU plumbing is real where it is
host-independent, and stubbed where it requires a configured GPU host** (see Scope).

## Scope

| Concern | This scaffold |
|---|---|
| HTTP API + CRUD + state machine | **Real, complete** |
| Compatibility gate (driver/cuda/topology/privilege) | **Real** (field comparison) |
| SSH: connect, run command, sftp push/pull, tar | **Real** (paramiko) |
| Container bootstrap command construction + issue over SSH | **Real** (command built + sent; success assumes a Docker host) |
| `cuda-checkpoint` (VRAM dump), CRIU dump/restore, CUDA API lock | **Stubbed** behind interfaces (return realistic results, flip state) |
| Provider create/destroy (RunPod, Vast) | **Stubbed** behind a `Provider` protocol; `local` is a no-op |

Each stub is isolated behind an interface so it can be swapped for a real
implementation without touching routes or the state machine.

## Stack

- **Python 3.11+**, **FastAPI** (auto OpenAPI docs at `/docs`).
- **SQLModel** (Pydantic + SQLAlchemy) for table models + request/response validation.
- **SQLite** single-file persistence (survives restarts). In-memory SQLite for tests.
- **paramiko** for SSH/SFTP.
- **pytest** + FastAPI `TestClient` for tests; SSH and provider interfaces are faked.

## Project layout

```
agentbox/
  app/
    main.py              # FastAPI app, lifespan (DB init), routers mounted at /api/v1
    config.py            # settings: db path, local artifact/state dir, SSH timeouts, match policy
    db.py                # SQLite engine + session dependency (SQLModel)
    models.py            # tables: Connection, Workspace
    schemas.py           # request/response models (secrets never echoed back)
    routers/
      connections.py     # GET / POST / DELETE
      workspaces.py      # GET list, POST create, GET {id}, POST deploy, POST freeze,
                         # GET {id}/compatible-connections
    services/
      ssh.py             # REAL — SSHClient protocol + paramiko impl + fake for tests
      compat.py          # REAL — compatibility evaluation (profile + privilege)
      deploy.py          # orchestrates deploy: pre-flight → bootstrap/restore → state flip
      checkpoint.py      # 4-step freeze pipeline; CRIU/cuda steps STUBBED
      providers.py       # Provider protocol; runpod/vast STUBBED, local no-op
  tests/
  pyproject.toml
  README.md
```

## Data model

### Connection
| field | type | notes |
|---|---|---|
| id | str (uuid) | PK |
| name | str | |
| ip_address | str | |
| user | str | SSH user |
| port | int | default 22 |
| ssh_key_path | str? | one of key/password required |
| password | str? | stored, **never returned** |
| gpu_type | str? | e.g. "A100-80GB" |
| driver_version | str? | e.g. "550.54.15" |
| cuda_version | str? | e.g. "12.4" |
| gpu_topology | str? | structured, e.g. "1xA100-80GB-SXM" |
| provider | enum | `runpod` \| `vast` \| `local` |
| provider_instance_id | str? | needed to destroy rented box on freeze |
| privileged | bool | default false |
| capabilities | list[str] | e.g. `["CAP_SYS_ADMIN","CAP_CHECKPOINT_RESTORE"]` |
| status | enum | `idle` \| `in_use` \| `offline` |
| last_connected | datetime? | |

**Validation:** exactly one of `ssh_key_path` / `password` must be present on create.
**Response model excludes `password` and `ssh_key_path`.**

### Workspace
| field | type | notes |
|---|---|---|
| id | str (uuid) | PK |
| name | str | |
| config_yaml | str | path or inline string |
| mcp_json | str | path or inline string |
| sqlite_db_path | str | local context db, e.g. "./local/context.db" |
| entrypoint | str | e.g. "server.py" |
| size_gb | float | default 0; updated after freeze |
| status | enum | `archived` \| `running` |
| active_connection_id | str? | set while running |
| artifact_path | str? | local `.tar` of the CRIU dump (after freeze) |
| frozen_profile | json? | `{driver_version, cuda_version, gpu_topology}` captured at freeze |

## Compatibility gate (real)

`services/compat.py` exposes `evaluate(workspace, connection) -> CompatResult`:

- **Privilege check (always):** connection must be `privileged` and include the required
  caps (`CAP_CHECKPOINT_RESTORE`, `CAP_SYS_ADMIN`). Else incompatible
  ("connection lacks CAP_CHECKPOINT_RESTORE — CRIU will fail").
- **Profile check (only if workspace has `frozen_profile`):** target connection's
  `driver_version`, `cuda_version`, and `gpu_topology` must match the frozen profile
  **exactly** (NVIDIA's documented hard rule). Mismatch → incompatible with a precise
  reason (e.g. "driver 535.x ≠ frozen 550.x").
- A never-frozen workspace skips the profile match (no source fingerprint yet) but still
  requires the privilege check.

`CompatResult = { compatible: bool, reasons: list[str] }`. Used by both the deploy
pre-flight and `GET /workspaces/{id}/compatible-connections`.

## State machine

Connection: `idle → in_use → idle`; `offline` set when a connection probe fails.
Workspace: `archived → running → archived`.

### deploy (`POST /workspaces/{id}/deploy`, body `{connection_id}`)
Pre-conditions: workspace `archived`, connection `idle`, `compat.evaluate(...)` compatible.
Any violation → `409` with reason.
1. (provider) ensure instance up — `local` no-op; `runpod`/`vast` create stubbed.
2. (SSH, real) push the bundle (`config_yaml`, `mcp_json`, `sqlite_db_path`, `entrypoint`,
   and `artifact_path` if present) to `~/agentbox/<workspace-id>/`.
3. (SSH, real) issue container bootstrap:
   `docker run -d --privileged --cap-add=CAP_CHECKPOINT_RESTORE --name agentbox-<id> ...`
   with the agent as **PID 1** in an isolated PID namespace.
   - fresh workspace → run `entrypoint`.
   - workspace with `artifact_path` → **CRIU-restore** the dump inside the container
     (restore call stubbed; push + container plumbing real).
4. State flip: workspace `running` + `active_connection_id`; connection `in_use`,
   `last_connected = now`.

### freeze (`POST /workspaces/{id}/freeze`)
Pre-condition: workspace `running` (else `409`). Resolve its `active_connection_id`.
Executes `services/checkpoint.py` as an ordered, individually-swappable pipeline; the
endpoint reports the **last step reached** so partial failures are debuggable:
1. **lock_cuda_api** (stub) — freeze CUDA submission so the agent submits no new work.
2. **cuda_checkpoint_dump** (stub) — VRAM → host RAM via `cuda-checkpoint`.
3. **criu_dump** (stub) — process tree + SQLite file locks + host RAM → folder on remote disk.
4. **teardown_and_pull** (real SSH): `tar` the remote dump folder, `scp`/sftp it to the
   local artifact dir as `<workspace-id>.tar`, then `provider.destroy_instance()`
   (provider API stubbed; `local` no-op).
On success: set `artifact_path`, capture `frozen_profile` from the connection,
update `size_gb` from the artifact, workspace `archived`, `active_connection_id=null`,
connection `idle`.

## API summary (`/api/v1`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/connections` | — | `[Connection]` (no secrets) |
| POST | `/connections` | name, ip_address, user, port?, ssh_key_path? \| password?, gpu_type?, driver_version?, cuda_version?, gpu_topology?, provider, provider_instance_id?, privileged?, capabilities? | `Connection` |
| DELETE | `/connections/{id}` | — | `204` |
| GET | `/workspaces` | — | `[Workspace]` |
| POST | `/workspaces` | name, config_yaml, mcp_json, sqlite_db_path, entrypoint | `Workspace` |
| GET | `/workspaces/{id}` | — | `Workspace` (full) |
| GET | `/workspaces/{id}/compatible-connections` | — | `[{connection, compatible, reasons}]` |
| POST | `/workspaces/{id}/deploy` | `{connection_id}` | `Workspace` (running) |
| POST | `/workspaces/{id}/freeze` | — | `Workspace` (archived) + freeze report |

## Errors

- `404` — unknown connection/workspace id.
- `409` — invalid state transition (deploy a running workspace, deploy to a busy
  connection, freeze a non-running workspace) or incompatible target (with reasons).
- `422` — request validation (automatic via Pydantic; includes the key/password XOR rule).
- `502` — SSH / provider failure, wrapped with a clear message and the step that failed.

## Testing

- **CRUD + state machine + compatibility**: full coverage with in-memory SQLite, no real hosts.
- **SSH and Provider faked** via their interfaces — deploy/freeze flows assert state
  transitions, the bootstrap command shape, the 4-step order, and the partial-failure report.
- **Validation**: key/password XOR, secrets absent from responses, exact-match compat rules
  (driver/cuda/topology mismatch each rejected; privilege missing rejected).

## Out of scope (later upgrades)

- Async/background deploy & freeze (currently synchronous).
- Real `cuda-checkpoint` / CRIU / CRIUgpu invocation and parallel VRAM transfer.
- Real RunPod / Vast provider API integration.
- Auth on the API itself; secret encryption at rest (currently plaintext in SQLite,
  excluded from responses only).
- Live connection health probing / topology auto-discovery.
