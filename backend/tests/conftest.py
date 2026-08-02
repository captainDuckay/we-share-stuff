import asyncio
from collections.abc import AsyncGenerator, Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import Settings, get_settings
from app.database import get_database_session
from app.main import create_app
from app.models import Base


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'test.db'}"
    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    settings = Settings(
        database_url=database_url,
        item_photo_storage_dir=str(tmp_path / "item-photos"),
        profile_photo_storage_dir=str(tmp_path / "profile-photos"),
        sharing_group_photo_storage_dir=str(tmp_path / "sharing-group-photos"),
    )
    app = create_app(settings)

    async def override_session() -> AsyncGenerator[AsyncSession]:
        async with session_factory() as session:
            yield session

    async def prepare_database() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(prepare_database())
    app.dependency_overrides[get_database_session] = override_session
    app.dependency_overrides[get_settings] = lambda: settings
    app.state.session_factory = session_factory
    app.state.engine = engine
    with TestClient(app) as test_client:
        yield test_client
    asyncio.run(engine.dispose())


@pytest.fixture
def csrf_headers(client: TestClient) -> dict[str, str]:
    response = client.get("/api/auth/session")
    assert response.status_code == 401
    token = client.cookies.get("XSRF-TOKEN")
    assert token
    return {"Origin": "http://localhost:4200", "X-XSRF-TOKEN": token}


@pytest.fixture
def seed_models(client: TestClient) -> Callable[..., None]:
    """Insert SQLAlchemy model instances via the test app's session factory."""

    session_factory: async_sessionmaker[AsyncSession] = client.app.state.session_factory

    def seed(*models: object) -> None:
        async def _run() -> None:
            async with session_factory() as session:
                for model in models:
                    session.add(model)
                await session.commit()

        asyncio.run(_run())

    return seed
