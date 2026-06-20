def _remote_dir(ws) -> str:
    return f"~/agentbox/{ws.id}"


def deploy_workspace(workspace, connection, ssh, provider) -> None:
    """Push the bundle and bootstrap a privileged container (agent = PID 1).

    Bundle fields are treated as local file paths (scaffold assumption).
    """
    provider.create_instance(connection)

    remote_dir = _remote_dir(workspace)
    ssh.run(connection, f"mkdir -p {remote_dir}")

    bundle = [
        workspace.config_yaml,
        workspace.mcp_json,
        workspace.sqlite_db_path,
        workspace.entrypoint,
    ]
    for path in bundle:
        ssh.push(connection, path, remote_dir)
    if workspace.artifact_path:
        ssh.push(connection, workspace.artifact_path, remote_dir)

    caps = " ".join(f"--cap-add={c}" for c in (connection.capabilities or []))
    container = f"agentbox-{workspace.id}"
    ssh.run(
        connection,
        f"docker run -d --privileged {caps} --name {container} "
        f"-v {remote_dir}:/workspace -w /workspace agentbox-runtime",
    )

    if workspace.artifact_path:
        # STUB: real impl runs `criu restore` inside the container (PID 1 preserved).
        ssh.run(connection, f"docker exec {container} criu restore -d -D /workspace/dump  # STUB restore")
    else:
        ssh.run(connection, f"docker exec {container} python {workspace.entrypoint}")
