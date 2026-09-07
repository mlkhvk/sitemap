from contextlib import asynccontextmanager
from datetime import date
from typing import List, Optional

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Body,
)

from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas
from app.database import engine, get_db
from app.crud import get_or_create_current_task

# ============================================================
# DATABASE
# ============================================================
# create_all для async-движка нужно запускать через run_sync


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Карта актуальности API",
    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ============================================================
# PROJECTS
# ============================================================


@app.get(
    "/projects",
    response_model=List[schemas.ProjectResponse],
)
async def read_projects(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_projects(
        db,
        skip=skip,
        limit=limit,
    )


@app.post(
    "/projects",
    response_model=schemas.ProjectResponse,
)
async def create_project(
    project: schemas.ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_project(
        db,
        project,
    )


@app.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    success = await crud.delete_project(
        db,
        project_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    return {
        "ok": True,
        "message": "Project deleted",
    }


# ============================================================
# PAGES
# ============================================================


@app.get(
    "/projects/{project_id}/pages",
    response_model=List[schemas.PageResponse],
)
async def read_pages(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_pages_by_project(
        db,
        project_id,
    )


@app.post(
    "/projects/{project_id}/pages",
    response_model=schemas.PageResponse,
)
async def create_page(
    project_id: int,
    page: schemas.PageCreate,
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_page(
        db,
        page,
        project_id,
    )


@app.put(
    "/pages/{page_id}",
    response_model=schemas.PageResponse,
)
async def update_page(
    page_id: int,
    page: schemas.PageCreate,
    db: AsyncSession = Depends(get_db),
):
    db_page = await crud.update_page(
        db,
        page_id,
        page,
    )

    if db_page is None:
        raise HTTPException(
            status_code=404,
            detail="Page not found",
        )

    return db_page


@app.delete("/pages/{page_id}")
async def delete_page(
    page_id: int,
    db: AsyncSession = Depends(get_db),
):
    success = await crud.delete_page(
        db,
        page_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Page not found",
        )

    return {
        "ok": True,
        "message": "Page deleted",
    }


# ============================================================
# ELEMENTS
# ============================================================


@app.get(
    "/pages/{page_id}/elements",
    response_model=List[schemas.ElementResponse],
)
async def read_elements(
    page_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_elements_by_page(
        db,
        page_id,
    )


@app.post(
    "/pages/{page_id}/elements",
    response_model=schemas.ElementResponse,
)
async def create_element(
    page_id: int,
    element: schemas.ElementCreate,
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_element(
        db,
        element,
        page_id,
    )


@app.delete("/elements/{element_id}")
async def delete_element(
    element_id: int,
    db: AsyncSession = Depends(get_db),
):
    success = await crud.delete_element(
        db,
        element_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Element not found",
        )

    return {
        "ok": True,
        "message": "Element deleted",
    }


# ============================================================
# EVENTS
# ============================================================


@app.get(
    "/events",
    response_model=List[schemas.EventResponse],
)
async def read_events(
    event_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_events(
        db,
        event_type,
    )


@app.post(
    "/events",
    response_model=schemas.EventResponse,
)
async def create_event(
    event: schemas.EventCreate,
    element_ids: List[int] = Body(
        ...,
        embed=True,
    ),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await crud.create_event(
            db,
            event,
            element_ids,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=404,
            detail=str(e),
        )


# ============================================================
# EVENTS OF ELEMENT
# ============================================================


@app.get(
    "/elements/{element_id}/events",
    response_model=List[schemas.EventResponse],
)
async def get_events_by_element(
    element_id: int,
    db: AsyncSession = Depends(get_db),
):
    # Проверяем существование элемента
    result = await db.execute(
        select(models.Element).filter(models.Element.id == element_id)
    )
    element = result.scalars().first()

    if not element:
        raise HTTPException(
            status_code=404,
            detail="Element not found",
        )

    return await crud.get_events_by_element(
        db,
        element_id,
    )


@app.post("/elements/{element_id}/events/{event_id}")
async def attach_event_to_element(
    element_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
):
    success = await crud.attach_event_to_element(
        db,
        element_id,
        event_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail=("Element or event not found"),
        )

    return {
        "ok": True,
        "message": "Event attached to element",
    }


@app.delete("/elements/{element_id}/events/{event_id}")
async def detach_event_from_element(
    element_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
):
    success = await crud.detach_event_from_element(
        db,
        element_id,
        event_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail=("Event association not found"),
        )

    return {
        "ok": True,
        "message": "Event detached from element",
    }


# ============================================================
# TOPICS
# ============================================================


@app.get(
    "/topics",
    response_model=List[schemas.TopicResponse],
)
async def read_topics(
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_topics(db)


@app.post(
    "/topics",
    response_model=schemas.TopicResponse,
)
async def create_topic(
    topic: schemas.TopicCreate,
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_topic(
        db,
        topic,
    )


# ============================================================
# TASKS
# ============================================================


@app.get(
    "/tasks",
    response_model=List[schemas.EventTaskResponse],
)
async def read_tasks(
    completed: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(models.EventTask)

    if completed is not None:
        query = query.filter(models.EventTask.completed == completed)

    result = await db.execute(query)
    tasks = result.scalars().all()

    today = date.today()

    for task in tasks:

        task.is_overdue = not task.completed and task.due_date < today

    return tasks


@app.post(
    "/tasks",
    response_model=schemas.EventTaskResponse,
)
async def create_task(
    task: schemas.EventTaskCreate,
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_event_task(
        db,
        task,
    )


@app.put(
    "/tasks/{task_id}",
    response_model=schemas.EventTaskResponse,
)
async def update_task(
    task_id: int,
    task_update: schemas.EventTaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    task = await crud.update_event_task(
        db,
        task_id,
        task_update,
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


@app.delete("/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    success = await crud.delete_event_task(
        db,
        task_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return {
        "ok": True,
        "message": "Task deleted",
    }


# ============================================================
# CREATE PAGE WITH ELEMENTS
# ============================================================


@app.post("/projects/{project_id}/pages_with_elements")
async def create_page_with_elements(
    project_id: int,
    page_data: dict,
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_page_with_elements(
        db,
        page_data,
        project_id,
    )


# ============================================================
# CHECKLIST
# ============================================================


@app.get(
    "/tasks/checklist",
    response_model=List[schemas.EventTaskResponse],
)
async def get_checklist(
    db: AsyncSession = Depends(get_db),
):
    # Регулярные события
    result = await db.execute(
        select(models.Event).filter(models.Event.event_type == "regular")
    )
    events = result.scalars().all()

    tasks = []

    for event in events:

        task = await get_or_create_current_task(
            db,
            event.id,
        )

        if task:
            tasks.append(task)

    # Нерегулярные события
    result = await db.execute(
        select(models.EventTask)
        .join(models.Event)
        .filter(models.Event.event_type == "irregular")
    )
    irregular_tasks = result.scalars().all()

    tasks.extend(irregular_tasks)

    return tasks
