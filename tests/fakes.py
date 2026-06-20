class FakeSSH:
    """Records commands/pushes/pulls; pull writes a small real file."""

    def __init__(self):
        self.commands = []
        self.pushes = []
        self.pulls = []

    def run(self, conn, command):
        self.commands.append(command)
        return 0, "ok", ""

    def push(self, conn, local_path, remote_dir):
        self.pushes.append((local_path, remote_dir))

    def pull(self, conn, remote_path, local_path):
        import os
        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(b"x" * 1024)
        self.pulls.append((remote_path, local_path))

    def test(self, conn):
        return True


class FakeProvider:
    def __init__(self):
        self.created = []
        self.destroyed = []

    def create_instance(self, conn):
        self.created.append(conn.id)
        return conn.provider_instance_id

    def destroy_instance(self, conn):
        self.destroyed.append(conn.id)
