# agentBox

**A control plane for portable GPU agent workloads.** agentBox manages a fleet of
SSH-reachable GPU machines and lets you *freeze* a running AI agent — its Python process,
its SQLite context, **and its GPU VRAM** — into a portable artifact, then *thaw* it back
onto any compatible machine. Think `docker run` / `docker commit`, but for live,
GPU-resident agent state across rented and owned hardware.

It exposes a small REST API (`/api/v1`) over two resources:

- **Connections** — the raw compute: bare-metal boxes, rented GPUs (RunPod / Vast), or local machines you reach over SSH.
- **Workspaces** — bundled agent environments and their frozen (checkpointed) state.

---

## Why this exists

Rented GPUs are expensive and ephemeral. You spin one up, an agent runs for a while,
and then you either keep paying for an idle box or kill it and lose all in-memory state.
agentBox automates the **checkpoint/restore dance** (CRIU + NVIDIA `cuda-checkpoint`) so
you can snapshot a live agent off the GPU, pull the artifact home, destroy the instance,
and later restore the exact same process onto a different machine — without the agent
ever knowing it moved.

---

## Core concepts

### Connection — a machine you can run on
Tracks how to reach a box **and** whether it can host a checkpointed workload:

| Field | Purpose |
|-------|---------|
| `ip_address`, `user`, `port`, `ssh_key_path` \| `password` | SSH access (exactly one auth method required) |
| `gpu_type`, `driver_version`, `cuda_version`, `gpu_topology` | hardware/driver **fingerprint** used for compatibility |
| `provider` (`runpod` \| `vast` \| `local`), `provider_instance_id` | lifecycle automation (destroy the rented box after freeze) |
| `privileged`, `capabilities` | CRIU needs a privileged container with `CAP_CHECKPOINT_RESTORE` / `CAP_SYS_ADMIN` |
| `status` (`idle` \| `in_use` \| `offline`) | fleet state |

Secrets (`password`, `ssh_key_path`) are stored but **never returned** by the API.

### Workspace — a portable agent
A bundle (`config_yaml`, `mcp_json`, `sqlite_db_path`, `entrypoint`) plus, once frozen,
the artifact and the hardware fingerprint it was captured on:

| Field | Purpose |
|-------|---------|
| `status` (`archived` \| `running`), `active_connection_id` | where it is right now |
| `artifact_path` | local `.tar` of the CRIU dump after a freeze |
| `frozen_profile` | `{driver_version, cuda_version, gpu_topology}` captured at freeze time |

---

## The lifecycle

```
            deploy(connection_id)                 freeze
 archived ───────────────────────▶ running ───────────────────▶ archived
   (idle conn)                    (conn in_use)               (conn idle, instance destroyed)
```

### Deploy — push an agent onto a machine
`POST /workspaces/{id}/deploy` with `{ "connection_id": "..." }`:
1. **Pre-flight compatibility gate** (see below) — rejects with `409` if the machine can't host it.
2. (provider) ensure the instance is up (`local` = no-op).
3. (real SSH) push the bundle to `~/agentbox/<workspace-id>/`.
4. (real SSH) bootstrap a **privileged container with the agent as PID 1** (`docker run --privileged --cap-add=...`) — PID 1 is what makes the process portable across machines.
5. Flip state: workspace → `running`, connection → `in_use`.

A workspace that already has an `artifact_path` is **restored** (CRIU restore inside the container) instead of started fresh.

### Freeze — snapshot it back and tear down
`POST /workspaces/{id}/freeze` runs the 4-step extraction dance, reporting the last step reached so partial failures are debuggable:
1. **lock_cuda_api** — stop the agent submitting new GPU work.
2. **cuda_checkpoint_dump** — copy VRAM → host RAM via `cuda-checkpoint`.
3. **criu_dump** — freeze the process tree, SQLite file locks, and host RAM to disk.
4. **teardown_and_pull** — `tar` the dump, `scp` it home as `<id>.tar`, then destroy the rented instance.

On success: workspace → `archived` with `artifact_path` + `frozen_profile`, connection → `idle`.

### Compatibility gate
NVIDIA's checkpoint/restore is strict: you cannot thaw a workload onto a different driver
or GPU topology. agentBox enforces this **before** deploy:
- **Privilege check (always):** the connection must be `privileged` and carry the required capabilities.
- **Profile check (only for previously-frozen workspaces):** the target's `driver_version`, `cuda_version`, and `gpu_topology` must match the `frozen_profile` **exactly**.

`GET /workspaces/{id}/compatible-connections` returns every connection with a
`compatible` flag and human-readable `reasons`, so a UI can grey out the boxes that won't work.

---

## API reference (`/api/v1`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET`  | `/connections` | — | list machines (no secrets) |
| `POST` | `/connections` | connection fields | add a machine |
| `DELETE` | `/connections/{id}` | — | remove a machine (`409` if `in_use`) |
| `GET`  | `/workspaces` | — | list agent bundles |
| `POST` | `/workspaces` | name, config_yaml, mcp_json, sqlite_db_path, entrypoint | create a bundle |
| `GET`  | `/workspaces/{id}` | — | full workspace detail |
| `GET`  | `/workspaces/{id}/compatible-connections` | — | which machines can host it, and why not |
| `POST` | `/workspaces/{id}/deploy` | `{connection_id}` | push + bootstrap on a machine |
| `POST` | `/workspaces/{id}/freeze` | — | checkpoint, pull artifact, tear down |

**Status codes:** `404` unknown id · `409` invalid state transition or incompatible target (with reasons) · `422` request validation · `502` SSH/provider failure (names the failing step).

Interactive docs are auto-generated at `/docs`.

---

## Quickstart

```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload
# open http://127.0.0.1:8000/docs
```

Example: register a local privileged box, create an agent, check fit, deploy, freeze.

```bash
BASE=http://127.0.0.1:8000/api/v1

# 1. Add a machine
curl -s $BASE/connections -X POST -H 'content-type: application/json' -d '{
  "name":"local-a100","ip_address":"10.0.0.5","user":"root","ssh_key_path":"~/.ssh/id_ed25519",
  "provider":"local","privileged":true,
  "capabilities":["CAP_SYS_ADMIN","CAP_CHECKPOINT_RESTORE"],
  "driver_version":"550.54.15","cuda_version":"12.4","gpu_topology":"1xA100-80GB-SXM"
}'

# 2. Create an agent workspace
curl -s $BASE/workspaces -X POST -H 'content-type: application/json' -d '{
  "name":"Data-Analyst-Agent","config_yaml":"./config.yaml","mcp_json":"./mcp.json",
  "sqlite_db_path":"./local/context.db","entrypoint":"server.py"
}'

# 3. See which machines can host it
curl -s $BASE/workspaces/<ws-id>/compatible-connections

# 4. Deploy, then later freeze
curl -s $BASE/workspaces/<ws-id>/deploy -X POST -H 'content-type: application/json' -d '{"connection_id":"<conn-id>"}'
curl -s $BASE/workspaces/<ws-id>/freeze -X POST
```

---

## Architecture

```
app/
  main.py            FastAPI app + lifespan (DB init), routers at /api/v1
  config.py          settings (db path, artifact dir, ssh timeout, required caps)
  db.py              SQLite engine + session dependency (SQLModel)
  models.py          Connection, Workspace tables
  schemas.py         request/response models (secrets excluded; key/password XOR)
  deps.py            injectable get_ssh / get_provider_resolver (swappable in tests)
  routers/
    connections.py   CRUD
    workspaces.py    CRUD + deploy + freeze + compatible-connections
  services/
    ssh.py           REAL paramiko client behind an SSHClient protocol
    compat.py        compatibility evaluation
    deploy.py        push bundle + bootstrap container
    checkpoint.py    4-step freeze pipeline (FreezeReport)
    providers.py     ComputeProvider protocol + local/runpod/vast
```

**Tech:** Python 3.11+, FastAPI, SQLModel/SQLite, paramiko, pytest.

The SSH layer, checkpoint pipeline, and cloud providers each sit behind an interface, so
the stubbed pieces can be swapped for real implementations without touching the routes or
the state machine.

---

## What's real vs. stubbed (this is a scaffold)

| Area | Status |
|------|--------|
| REST API, CRUD, state machine, compatibility gate | **real** |
| SSH: connect, run, sftp push/pull, tar | **real** (paramiko) |
| Container bootstrap command (issued over SSH) | **real** (assumes a reachable Docker daemon) |
| `cuda-checkpoint` VRAM dump, CRIU dump/restore, CUDA API lock | **stubbed** behind interfaces |
| RunPod / Vast instance create & destroy | **stubbed** (`local` is a no-op) |

Other scaffold assumptions:
- Deploy treats `config_yaml` / `mcp_json` / `sqlite_db_path` / `entrypoint` as **file paths** to push.
- Secrets are stored plaintext in SQLite (excluded from responses); no encryption at rest, no API auth.
- Deploy/freeze are **synchronous**.

### Operational constraints the design accounts for
- **Privilege:** CRIU needs `CAP_SYS_ADMIN` + `CAP_CHECKPOINT_RESTORE` (a `--privileged` container).
- **PID stability:** restore demands the original PID — the agent runs as **PID 1** in an isolated container PID namespace so it's universally portable.
- **Driver/topology lock:** you cannot thaw across mismatched driver versions or GPU layouts — enforced by the exact-match compatibility gate.

### Roadmap (out of scope here)
Real `cuda-checkpoint` / CRIU / CRIUgpu integration with parallel VRAM transfer · real
RunPod / Vast APIs · async/background deploy & freeze · API auth + secret encryption ·
live connection health probing and topology auto-discovery.

---

## Testing

```bash
pytest -v
```

32 tests cover CRUD, validation, the compatibility gate, the freeze pipeline (including
partial-failure reporting), deploy orchestration, and the full deploy→freeze round-trip.
SSH and providers are faked via their interfaces, so the suite needs no real hosts. (One
SSH test intentionally hits a reserved address to exercise the connect-timeout path, so a
full run takes ~60s.)
