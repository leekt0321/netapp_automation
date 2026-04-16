from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Storage AI Web"
    app_env: str = "dev"
    database_url: str
    upload_dir: str = "upload"
    allowed_upload_extensions: str = ".log,.txt"
    admin_username: str = "admin"
    admin_password: str = "admin1234"
    admin_full_name: str = "Baobab Administrator"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
