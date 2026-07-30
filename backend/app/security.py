import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Final

from pwdlib import PasswordHash

SESSION_TOKEN_BYTES: Final = 32
CSRF_TOKEN_BYTES: Final = 32
SESSION_TTL_DAYS: Final = 7
_password_hasher = PasswordHash.recommended()


def normalize_email(value: str) -> str:
    return value.strip().casefold()


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hasher.verify(password, password_hash)


def session_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=SESSION_TTL_DAYS)


def now_utc() -> datetime:
    return datetime.now(UTC)
