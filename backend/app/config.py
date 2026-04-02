from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://audifi:audifi@localhost:5432/audifi"
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    cors_origins: str = "http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:5500,http://localhost:5500"
    timezone: str = "Africa/Accra"
    seed_demo_password: str = "password123"


settings = Settings()
