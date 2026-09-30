from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.orm import declarative_base


DATABASE_URL = "postgresql+asyncpg://postgres:1234@db:5432/mapsite"

engine = create_async_engine(DATABASE_URL)

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

Base = declarative_base()

async def get_db():
    async with SessionLocal() as db:
        yield db