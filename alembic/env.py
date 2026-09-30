import asyncio
from logging.config import fileConfig

from sqlalchemy.engine import Connection
from alembic import context

from app.database import Base, engine


target_metadata = Base.metadata


# Запускает миграции в offline режиме
def run_migrations_offline() -> None:
    url = context.config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# Выполняет миграции через переданное подключение
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
    )

    with context.begin_transaction():
        context.run_migrations()


# Запускает асинхронные миграции через существующий engine
async def run_async_migrations() -> None:
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)


# Запускает миграции в online режиме
def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()