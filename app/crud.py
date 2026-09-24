from typing import List, Optional
from datetime import datetime, date, timedelta

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, schemas

# ============================================================
# PROJECTS
# ============================================================


async def get_projects(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
):
    result = await db.execute(select(models.Project).offset(skip).limit(limit))
    return result.scalars().all()


async def get_project(
    db: AsyncSession,
    project_id: int,
):
    result = await db.execute(
        select(models.Project).filter(models.Project.id == project_id)
    )
    return result.scalars().first()


async def create_project(
    db: AsyncSession,
    project: schemas.ProjectCreate,
):
    db_project = models.Project(
        name=project.name,
    )

    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)

    return db_project


async def delete_project(
    db: AsyncSession,
    project_id: int,
):
    result = await db.execute(
        select(models.Project).filter(models.Project.id == project_id)
    )
    db_project = result.scalars().first()

    if not db_project:
        return False

    await db.delete(db_project)
    await db.commit()

    return True


# ============================================================
# PAGES
# ============================================================


async def get_pages_by_project(
    db: AsyncSession,
    project_id: int,
):
    result = await db.execute(
        select(models.Page).filter(models.Page.project_id == project_id)
    )
    return result.scalars().all()


async def create_page(
    db: AsyncSession,
    page: schemas.PageCreate,
    project_id: int,
):
    parent_id = page.parent_page_id

    # 0 означает отсутствие родительской страницы
    if parent_id == 0:
        parent_id = None

    # Если parent_id не указан,
    # пытаемся определить родителя по URL
    if parent_id is None and page.links:
        new_page_url = page.links[0].url

        result = await db.execute(
            select(
                models.Page,
                models.PageLink,
            )
            .join(
                models.PageLink,
                models.Page.id == models.PageLink.page_id,
            )
            .filter(models.Page.project_id == project_id)
        )
        all_pages = result.all()

        possible_parent = None
        max_len = 0

        for page_obj, link_obj in all_pages:
            if len(link_obj.url) < len(new_page_url) and new_page_url.startswith(
                link_obj.url + "/"
            ):
                if len(link_obj.url) > max_len:
                    max_len = len(link_obj.url)
                    possible_parent = page_obj.id

        if possible_parent:
            parent_id = possible_parent

    db_page = models.Page(
        title=page.title,
        parent_page_id=parent_id,
        project_id=project_id,
    )

    db.add(db_page)
    await db.flush()

    for link in page.links:
        db_link = models.PageLink(
            page_id=db_page.id,
            url=link.url,
        )

        db.add(db_link)

    await db.commit()
    await db.refresh(db_page)

    return db_page


async def update_page(
    db: AsyncSession,
    page_id: int,
    page_update: schemas.PageCreate,
):
    result = await db.execute(select(models.Page).filter(models.Page.id == page_id))
    db_page = result.scalars().first()

    if not db_page:
        return None

    parent_id = page_update.parent_page_id

    if parent_id == 0:
        parent_id = None

    db_page.title = page_update.title
    db_page.parent_page_id = parent_id

    # Удаляем старые ссылки
    await db.execute(
        delete(models.PageLink)
        .filter(models.PageLink.page_id == page_id)
        .execution_options(synchronize_session=False)
    )

    # Добавляем новые ссылки
    for link in page_update.links:
        db_link = models.PageLink(
            page_id=page_id,
            url=link.url,
        )

        db.add(db_link)

    await db.commit()
    await db.refresh(db_page)

    return db_page


async def delete_page(db: AsyncSession, page_id: int):
    result = await db.execute(select(models.Page).filter(models.Page.id == page_id))
    page = result.scalars().first()

    if not page:
        return False

    await db.delete(page)
    await db.commit()

    return True


# ============================================================
# ELEMENTS
# ============================================================


async def get_elements_by_page(
    db: AsyncSession,
    page_id: int,
):
    result = await db.execute(
        select(models.Element).filter(models.Element.page_id == page_id)
    )
    return result.scalars().all()


async def create_element(
    db: AsyncSession,
    element: schemas.ElementCreate,
    page_id: int,
):
    db_element = models.Element(
        name=element.name,
        parent_element_id=element.parent_element_id,
        sort_order=element.sort_order,
        page_id=page_id,
    )

    db.add(db_element)
    await db.commit()
    await db.refresh(db_element)

    return db_element


async def delete_element(db: AsyncSession, element_id: int):
    result = await db.execute(
        select(models.Element).filter(models.Element.id == element_id)
    )
    element = result.scalars().first()

    if not element:
        return False

    await db.delete(element)
    await db.commit()

    return True


# ============================================================
# EVENTS
# ============================================================


async def get_events(
    db: AsyncSession,
    event_type: Optional[str] = None,
):
    query = select(models.Event)

    if event_type:
        query = query.filter(models.Event.event_type == event_type)

    result = await db.execute(query)
    return result.scalars().all()


async def create_event(
    db: AsyncSession,
    event: schemas.EventCreate,
    element_ids: List[int],
):
    # Создаём событие
    db_event = models.Event(
        name=event.name,
        event_type=event.event_type,
        periodicity=event.periodicity,
        start_date=event.start_date,
        topic_id=event.topic_id,
    )

    db.add(db_event)

    await db.flush()

    # Создаём связи ElementEvent
    for element_id in element_ids:

        result = await db.execute(
            select(models.Element).filter(
                models.Element.id == element_id
            )
        )

        element = result.scalars().first()

        if not element:
            await db.rollback()

            raise ValueError(
                f"Element {element_id} not found"
            )

        association = models.ElementEvent(
            element_id=element.id,
            event_id=db_event.id,
        )

        db.add(association)

    await db.commit()

    await db.refresh(db_event)

    return db_event

async def update_event(
    db: AsyncSession,
    event_id: int,
    event,
    element_ids,
):
    result = await db.execute(
        select(models.Event).filter(models.Event.id == event_id)
    )
    db_event = result.scalars().first()

    if not db_event:
        return None

    db_event.name = event.name.strip()
    db_event.event_type = event.event_type

    db_event.periodicity = (
        event.periodicity
        if event.event_type == 'regular'
        else None
    )

    db_event.start_date = (
        event.start_date
        if event.event_type == 'regular'
        else None
    )

    db_event.topic_id = (
        event.topic_id
        if event.event_type == 'irregular'
        else None
    )

    # Удаляем старые привязки
    await db.execute(
        delete(models.ElementEvent).where(
            models.ElementEvent.event_id == event_id
        )
    )

    # Создаём новые
    for element_id in element_ids:
        element_result = await db.execute(
            select(models.Element).filter(
                models.Element.id == element_id
            )
        )

        element = element_result.scalars().first()

        if not element:
            await db.rollback()
            raise ValueError(
                f'Element {element_id} not found'
            )

        db.add(
            models.ElementEvent(
                element_id=element.id,
                event_id=event_id,
            )
        )

    await db.commit()
    await db.refresh(db_event)

    return db_event

async def delete_event(
    db: AsyncSession,
    event_id: int,
):
    # Проверяем, существует ли событие
    result = await db.execute(
        select(models.Event).filter(
            models.Event.id == event_id
        )
    )

    event = result.scalars().first()

    if not event:
        return False

    # Удаляем задачи события
    await db.execute(
        delete(models.EventTask)
        .where(
            models.EventTask.event_id == event_id
        )
    )

    # Удаляем связи события с элементами
    await db.execute(
        delete(models.ElementEvent)
        .where(
            models.ElementEvent.event_id == event_id
        )
    )

    # Удаляем само событие
    await db.delete(event)

    await db.commit()

    return True


# ============================================================
# EVENT ↔ ELEMENT
# ============================================================


async def get_events_by_element(
    db: AsyncSession,
    element_id: int,
):
    """
    Возвращает события, привязанные к элементу.
    """

    result = await db.execute(
        select(models.Event)
        .join(
            models.ElementEvent,
            models.Event.id == models.ElementEvent.event_id,
        )
        .filter(models.ElementEvent.element_id == element_id)
    )
    return result.scalars().all()

async def get_event_elements(db: AsyncSession, event_id: int):
    result = await db.execute(
        select(models.ElementEvent).filter(
            models.ElementEvent.event_id == event_id
        )
    )
    return result.scalars().all()

async def get_event_elements_by_element(
    db: AsyncSession,
    element_id: int,
):
    """
    Возвращает записи промежуточной таблицы
    ElementEvent для конкретного элемента.
    """

    result = await db.execute(
        select(models.ElementEvent).filter(models.ElementEvent.element_id == element_id)
    )
    return result.scalars().all()


async def attach_event_to_element(
    db: AsyncSession,
    element_id: int,
    event_id: int,
):
    # Проверяем существование элемента
    result = await db.execute(
        select(models.Element).filter(models.Element.id == element_id)
    )
    element = result.scalars().first()

    if not element:
        return False

    # Проверяем существование события
    result = await db.execute(select(models.Event).filter(models.Event.id == event_id))
    event = result.scalars().first()

    if not event:
        return False

    # Проверяем, нет ли уже такой связи
    result = await db.execute(
        select(models.ElementEvent).filter(
            models.ElementEvent.element_id == element_id,
            models.ElementEvent.event_id == event_id,
        )
    )
    exists = result.scalars().first()

    if exists:
        return True

    association = models.ElementEvent(
        element_id=element_id,
        event_id=event_id,
    )

    db.add(association)
    await db.commit()

    return True


async def detach_event_from_element(
    db: AsyncSession,
    element_id: int,
    event_id: int,
):
    """
    Удаляет связь конкретного события
    с конкретным элементом.
    """

    result = await db.execute(
        select(models.ElementEvent).filter(
            models.ElementEvent.element_id == element_id,
            models.ElementEvent.event_id == event_id,
        )
    )
    association = result.scalars().first()

    if not association:
        return False

    await db.delete(association)
    await db.commit()

    return True


# ============================================================
# TOPICS
# ============================================================


# ============================================================
# TOPICS
# ============================================================

async def get_topics(
    db: AsyncSession,
):
    result = await db.execute(
        select(models.Topic)
    )

    return result.scalars().all()


async def create_topic(
    db: AsyncSession,
    topic,
):
    db_topic = models.Topic(
        name=topic.name.strip()
    )

    db.add(db_topic)

    await db.commit()
    await db.refresh(db_topic)

    return db_topic


async def update_topic(
    db: AsyncSession,
    topic_id: int,
    topic,
):
    result = await db.execute(
        select(models.Topic).filter(
            models.Topic.id == topic_id
        )
    )

    db_topic = result.scalars().first()

    if not db_topic:
        return None

    new_name = topic.name.strip()

    if not new_name:
        raise ValueError(
            "Название темы не может быть пустым"
        )

    db_topic.name = new_name

    await db.commit()
    await db.refresh(db_topic)

    return db_topic


async def delete_topic(
    db: AsyncSession,
    topic_id: int,
):
    result = await db.execute(
        select(models.Topic).filter(
            models.Topic.id == topic_id
        )
    )

    db_topic = result.scalars().first()

    if not db_topic:
        return False

    # ========================================================
    # ВАЖНО:
    # Все события этой темы переводим в "Без темы".
    #
    # Мы НЕ удаляем события.
    # Просто убираем topic_id.
    # ========================================================

    events_result = await db.execute(
        select(models.Event).filter(
            models.Event.topic_id == topic_id
        )
    )

    events = events_result.scalars().all()

    for event in events:
        event.topic_id = None

    # ========================================================
    # Теперь удаляем саму тему
    # ========================================================

    await db.delete(db_topic)

    await db.commit()

    return True


# ============================================================
# TASKS
# ============================================================


async def get_event_tasks(
    db: AsyncSession,
    completed: Optional[bool] = None,
):
    query = select(models.EventTask)

    if completed is not None:
        query = query.filter(models.EventTask.completed == completed)

    result = await db.execute(query)
    return result.scalars().all()


async def create_event_task(
    db: AsyncSession,
    task: schemas.EventTaskCreate,
):
    db_task = models.EventTask(
        event_id=task.event_id,
        due_date=task.due_date,
    )

    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)

    return db_task


async def update_event_task(
    db: AsyncSession,
    task_id: int,
    task_update: schemas.EventTaskUpdate,
):
    result = await db.execute(
        select(models.EventTask).filter(models.EventTask.id == task_id)
    )
    db_task = result.scalars().first()

    if not db_task:
        return None

    db_task.completed = task_update.completed

    if task_update.completed:
        db_task.completed_at = datetime.utcnow()
    else:
        db_task.completed_at = None

    await db.commit()
    await db.refresh(db_task)

    return db_task


async def delete_event_task(
    db: AsyncSession,
    task_id: int,
):
    result = await db.execute(
        select(models.EventTask).filter(models.EventTask.id == task_id)
    )
    db_task = result.scalars().first()

    if not db_task:
        return False

    await db.delete(db_task)
    await db.commit()

    return True


# ============================================================
# DATE CALCULATION
# ============================================================
# Чистая функция, к БД не обращается — остаётся синхронной.


def calculate_next_due_date(
    start_date: date,
    periodicity: str,
    reference_date: date = None,
):
    """
    Вычисляет ближайшую дату выполнения,
    которая >= reference_date.
    """

    if reference_date is None:
        reference_date = date.today()

    if reference_date < start_date:
        return start_date

    if periodicity == "ежегодно":

        try:
            next_date = start_date.replace(year=reference_date.year)
        except ValueError:
            # Например, 29 февраля
            next_date = start_date.replace(
                year=reference_date.year,
                day=28,
            )

        if next_date < reference_date:

            try:
                next_date = start_date.replace(year=reference_date.year + 1)
            except ValueError:
                next_date = start_date.replace(
                    year=reference_date.year + 1,
                    day=28,
                )

        return next_date

    elif periodicity == "ежемесячно":

        next_date = start_date + relativedelta(
            months=(
                (reference_date.year - start_date.year) * 12
                + reference_date.month
                - start_date.month
            )
        )

        if next_date < reference_date:
            next_date += relativedelta(months=1)

        return next_date

    elif periodicity == "еженедельно":

        days_diff = (reference_date - start_date).days

        weeks_passed = days_diff // 7

        next_date = start_date + timedelta(weeks=weeks_passed)

        if next_date < reference_date:
            next_date += timedelta(weeks=1)

        return next_date

    elif periodicity == "раз в квартал":

        months_diff = (reference_date.year - start_date.year) * 12 + (
            reference_date.month - start_date.month
        )

        quarters_passed = months_diff // 3

        next_date = start_date + relativedelta(months=quarters_passed * 3)

        if next_date < reference_date:
            next_date += relativedelta(months=3)

        return next_date

    return None


# ============================================================
# PAGE WITH ELEMENTS
# ============================================================


async def create_page_with_elements(
    db: AsyncSession,
    page_data: dict,
    project_id: int,
):
    db_page = models.Page(
        title=page_data["title"],
        project_id=project_id,
        parent_page_id=page_data.get("parent_page_id"),
    )

    db.add(db_page)
    await db.flush()

    # Создаём ссылки
    for link in page_data.get(
        "links",
        [],
    ):
        db_link = models.PageLink(
            page_id=db_page.id,
            url=link["url"],
        )

        db.add(db_link)

    # Рекурсивное создание элементов
    async def create_elements(
        elements,
        parent_id=None,
    ):
        for element_data in elements:

            db_element = models.Element(
                page_id=db_page.id,
                parent_element_id=parent_id,
                name=element_data["name"],
                sort_order=element_data.get(
                    "sort_order",
                    0,
                ),
            )

            db.add(db_element)
            await db.flush()

            if element_data.get("children"):
                await create_elements(
                    element_data["children"],
                    db_element.id,
                )

    await create_elements(
        page_data.get(
            "elements",
            [],
        )
    )

    await db.commit()
    await db.refresh(db_page)

    return db_page


# ============================================================
# CURRENT TASK
# ============================================================


async def get_or_create_current_task(
    db: AsyncSession,
    event_id: int,
):
    """
    Возвращает задание для текущего периода
    или создаёт его.
    """

    result = await db.execute(select(models.Event).filter(models.Event.id == event_id))
    event = result.scalars().first()

    if not event or event.event_type != "regular":
        return None

    next_due_date = calculate_next_due_date(
        event.start_date,
        event.periodicity,
    )

    if next_due_date is None:
        return None

    result = await db.execute(
        select(models.EventTask).filter(
            models.EventTask.event_id == event_id,
            models.EventTask.due_date == next_due_date,
        )
    )
    task = result.scalars().first()

    if not task:

        task = models.EventTask(
            event_id=event_id,
            due_date=next_due_date,
            completed=False,
        )

        db.add(task)
        await db.commit()
        await db.refresh(task)

    return task
