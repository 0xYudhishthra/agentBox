# agentBox backend

FastAPI backend that manages SSH-reachable GPU machines (Connections) and portable
agent environments (Workspaces), automating the CRIU/cuda-checkpoint deploy/freeze
dance. SSH is real (paramiko); checkpoint internals and cloud-provider APIs are stubbed
behind interfaces.

## Run
```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload
# docs at http://127.0.0.1:8000/docs
```

## Test
```bash
pytest -v
```

## Scaffold assumptions
- Deploy treats `config_yaml`, `mcp_json`, `sqlite_db_path`, `entrypoint` as **file paths** to push.
- Target hosts have a reachable **Docker daemon**; the agent runs as **PID 1** in a privileged container.
- Checkpoint steps 1-3 (`lock_cuda_api`, `cuda_checkpoint_dump`, `criu_dump`) and provider
  create/destroy are **stubs** that issue placeholder SSH commands / no-ops. Step 4
  (`tar` + `scp` pull) uses real SSH.
- Secrets (`password`, `ssh_key_path`) are stored plaintext in SQLite and excluded from responses; no encryption at rest, no API auth.
- Compatibility is **exact-match** on driver/cuda/topology plus a privilege/capabilities check.
