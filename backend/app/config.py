from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://we_share_stuff:we_share_stuff@localhost:5432/we_share_stuff"
    environment: Literal["development", "test", "production"] = "development"
    frontend_origins: str = "http://localhost:4200"
    session_cookie_name: str = "wss_session"
    csrf_cookie_name: str = "XSRF-TOKEN"
    cookie_secure: bool = False
    item_photo_storage_dir: str = "var/item-photos"
    profile_photo_storage_dir: str = "var/profile-photos"
    sharing_group_photo_storage_dir: str = "var/sharing-group-photos"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("environment", mode="before")
    @classmethod
    def normalize_environment(cls, value: str) -> str:
        return value.strip().casefold()

    @model_validator(mode="after")
    def validate_deployment_security(self) -> "Settings":
        origins = self.origins
        if not origins:
            raise ValueError("frontend_origins must contain at least one origin")
        if "*" in origins:
            raise ValueError("frontend_origins must not use wildcard origins")
        if self.environment == "production" and not self.cookie_secure:
            raise ValueError("cookie_secure must be enabled in production")
        return self

    @property
    def origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
