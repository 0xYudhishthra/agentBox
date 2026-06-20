from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGENTBOX_")

    db_path: str = "agentbox.db"
    artifact_dir: str = "local/artifacts"
    ssh_timeout: int = 30
    required_caps: list[str] = ["CAP_SYS_ADMIN", "CAP_CHECKPOINT_RESTORE"]


settings = Settings()
