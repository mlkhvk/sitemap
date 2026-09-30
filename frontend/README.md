# Карта актуальности

Веб-приложение для создания и управления картой актуальности проекта: страницами, элементами, событиями, темами и задачами.

## Технологии

* React
* Tailwind CSS
* FastAPI
* SQLAlchemy
* PostgreSQL
* Nginx
* Docker

## Первый запуск

### 1. Запустить проект

Перейти в корневую папку проекта:

```bash
cd sitemap
```

Запустить Docker Compose:

```bash
docker compose up --build
```

При первом запуске будут созданы контейнеры:

* `frontend` — React + Nginx
* `backend` — FastAPI
* `db` — PostgreSQL

### 2. Открыть приложение

После успешного запуска открыть:

```text
http://localhost
```

Swagger API:

```text
http://localhost:8000/docs
```

## Остановка

```bash
docker compose down
```

Данные базы данных при этом сохраняются.

## Повторный запуск

```bash
docker compose up
```

Если были изменены Dockerfile, зависимости или конфигурация:

```bash
docker compose up --build
```

## Полное удаление базы данных

Если необходимо создать новую чистую базу:

```bash
docker compose down -v
```

После этого:

```bash
docker compose up --build
```

> `docker compose down -v` удаляет данные PostgreSQL, сохранённые в Docker volume.
