from typing import List, Optional
from datetime import datetime, date, timedelta

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas


# Получает список проектов
async def get_projects(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
):
    result = await db.execute(
        select(models.Project).offset(skip).limit(limit)
    )
    return result.scalars().all()


# Получает проект по его идентификатору
async def get_project(
    db: AsyncSession,
    project_id: int,
):
    result = await db.execute(
        select(models.Project).filter(models.Project.id == project_id)
    )
    return result.scalars().first()


# Создаёт новый проект
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


# Удаляет проект по его идентификатору
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


# Получает все страницы проекта
async def get_pages_by_project(
    db: AsyncSession,
    project_id: int,
):
    result = await db.execute(
        select(models.Page).filter(models.Page.project_id == project_id)
    )
    return result.scalars().all()


# Создаёт страницу и определяет её родительскую страницу по URL
async def create_page(
    db: AsyncSession,
    page: schemas.PageCreate,
    project_id: int,
):
    parent_id = page.parent_page_id

    if parent_id == 0:
        parent_id = None

    # Если родитель не указан, определяем его по URL
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
            if (
                len(link_obj.url) < len(new_page_url)
                and new_page_url.startswith(link_obj.url + "/")
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


# Обновляет страницу и её ссылки
async def update_page(
    db: AsyncSession,
    page_id: int,
    page_update: schemas.PageCreate,
):
    result = await db.execute(
        select(models.Page).filter(models.Page.id == page_id)
    )
    db_page = result.scalars().first()

    if not db_page:
        return None

    parent_id = page_update.parent_page_id

    if parent_id == 0:
        parent_id = None

    db_page.title = page_update.title
    db_page.parent_page_id = parent_id

    await db.execute(
        delete(models.PageLink)
        .filter(models.PageLink.page_id == page_id)
        .execution_options(synchronize_session=False)
    )

    for link in page_update.links:
        db_link = models.PageLink(
            page_id=page_id,
            url=link.url,
        )

        db.add(db_link)

    await db.commit()
    await db.refresh(db_page)

    return db_page


# Удаляет страницу по её идентификатору
async def delete_page(
    db: AsyncSession,
    page_id: int,
):
    result = await db.execute(
        select(models.Page).filter(models.Page.id == page_id)
    )
    page = result.scalars().first()

    if not page:
        return False

    await db.delete(page)
    await db.commit()

    return True


# Получает все элементы страницы
async def get_elements_by_page(
    db: AsyncSession,
    page_id: int,
):
    result = await db.execute(
        select(models.Element).filter(models.Element.page_id == page_id)
    )
    return result.scalars().all()


# Создаёт новый элемент страницы
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


# Удаляет элемент по его идентификатору
async def delete_element(
    db: AsyncSession,
    element_id: int,
):
    result = await db.execute(
        select(models.Element).filter(models.Element.id == element_id)
    )
    element = result.scalars().first()

    if not element:
        return False

    await db.delete(element)
    await db.commit()

    return True


# Получает события проекта с возможностью фильтрации по типу
async def get_events(
    db: AsyncSession,
    project_id: int,
    event_type: Optional[str] = None,
):
    query = select(models.Event).filter(
        models.Event.project_id == project_id
    )

    if event_type:
        query = query.filter(models.Event.event_type == event_type)

    result = await db.execute(query)
    return result.scalars().all()


# Создаёт событие и связывает его с элементами
async def create_event(
    db: AsyncSession,
    event: schemas.EventCreate,
    element_ids: List[int],
):
    project_result = await db.execute(
        select(models.Project).filter(
            models.Project.id == event.project_id
        )
    )
    project = project_result.scalars().first()

    if not project:
        raise ValueError(
            f"Project {event.project_id} not found"
        )

    if event.topic_id is not None:
        topic_result = await db.execute(
            select(models.Topic).filter(
                models.Topic.id == event.topic_id,
                models.Topic.project_id == event.project_id,
            )
        )
        topic = topic_result.scalars().first()

        if not topic:
            raise ValueError(
                f"Topic {event.topic_id} does not belong to project {event.project_id}"
            )

    db_event = models.Event(
        name=event.name,
        project_id=event.project_id,
        event_type=event.event_type,
        periodicity=event.periodicity,
        start_date=event.start_date,
        topic_id=event.topic_id,
    )

    db.add(db_event)
    await db.flush()

    for element_id in element_ids:
        result = await db.execute(
            select(models.Element)
            .join(
                models.Page,
                models.Page.id == models.Element.page_id,
            )
            .filter(
                models.Element.id == element_id,
                models.Page.project_id == event.project_id,
            )
        )

        element = result.scalars().first()

        if not element:
            await db.rollback()

            raise ValueError(
                f"Element {element_id} does not belong to project {event.project_id}"
            )

        db.add(
            models.ElementEvent(
                element_id=element.id,
                event_id=db_event.id,
            )
        )

    await db.commit()
    await db.refresh(db_event)

    return db_event


# Обновляет событие и его связи с элементами
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
        if event.event_type == "regular"
        else None
    )

    db_event.start_date = (
        event.start_date
        if event.event_type == "regular"
        else None
    )

    db_event.topic_id = (
        event.topic_id
        if event.event_type == "irregular"
        else None
    )

    if db_event.topic_id is not None:
        topic_result = await db.execute(
            select(models.Topic).filter(
                models.Topic.id == db_event.topic_id,
                models.Topic.project_id == db_event.project_id,
            )
        )
        topic = topic_result.scalars().first()

        if not topic:
            await db.rollback()

            raise ValueError(
                f"Topic {db_event.topic_id} does not belong to project {db_event.project_id}"
            )

    await db.execute(
        delete(models.ElementEvent).where(
            models.ElementEvent.event_id == event_id
        )
    )

    for element_id in element_ids:
        element_result = await db.execute(
            select(models.Element)
            .join(
                models.Page,
                models.Page.id == models.Element.page_id,
            )
            .filter(
                models.Element.id == element_id,
                models.Page.project_id == db_event.project_id,
            )
        )

        element = element_result.scalars().first()

        if not element:
            await db.rollback()

            raise ValueError(
                f"Element {element_id} not found"
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


# Удаляет событие и связанные с ним записи
async def delete_event(
    db: AsyncSession,
    event_id: int,
):
    result = await db.execute(
        select(models.Event).filter(
            models.Event.id == event_id
        )
    )

    event = result.scalars().first()

    if not event:
        return False

    await db.execute(
        delete(models.EventTask).where(
            models.EventTask.event_id == event_id
        )
    )

    await db.execute(
        delete(models.ElementEvent).where(
            models.ElementEvent.event_id == event_id
        )
    )

    await db.delete(event)
    await db.commit()

    return True


# Получает события, привязанные к элементу
async def get_events_by_element(
    db: AsyncSession,
    element_id: int,
):
    result = await db.execute(
        select(models.Event)
        .join(
            models.ElementEvent,
            models.Event.id == models.ElementEvent.event_id,
        )
        .filter(models.ElementEvent.element_id == element_id)
    )
    return result.scalars().all()


# Получает элементы, привязанные к событию
async def get_event_elements(
    db: AsyncSession,
    event_id: int,
):
    result = await db.execute(
        select(models.ElementEvent).filter(
            models.ElementEvent.event_id == event_id
        )
    )
    return result.scalars().all()


# Получает связи событий с конкретным элементом
async def get_event_elements_by_element(
    db: AsyncSession,
    element_id: int,
):
    result = await db.execute(
        select(models.ElementEvent).filter(
            models.ElementEvent.element_id == element_id
        )
    )
    return result.scalars().all()


# Привязывает событие к элементу
async def attach_event_to_element(
    db: AsyncSession,
    element_id: int,
    event_id: int,
):
    result = await db.execute(
        select(models.Element).filter(
            models.Element.id == element_id
        )
    )
    element = result.scalars().first()

    if not element:
        return False

    result = await db.execute(
        select(models.Event).filter(
            models.Event.id == event_id
        )
    )
    event = result.scalars().first()

    if not event:
        return False

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


# Удаляет связь события с элементом
async def detach_event_from_element(
    db: AsyncSession,
    element_id: int,
    event_id: int,
):
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


# Получает все темы проекта
async def get_topics(
    db: AsyncSession,
    project_id: int,
):
    result = await db.execute(
        select(models.Topic).filter(
            models.Topic.project_id == project_id
        )
    )

    return result.scalars().all()


# Создаёт новую тему
async def create_topic(
    db: AsyncSession,
    topic: schemas.TopicCreate,
):
    project_result = await db.execute(
        select(models.Project).filter(
            models.Project.id == topic.project_id
        )
    )
    project = project_result.scalars().first()

    if not project:
        raise ValueError(
            f"Project {topic.project_id} not found"
        )

    db_topic = models.Topic(
        name=topic.name.strip(),
        project_id=topic.project_id,
    )

    db.add(db_topic)

    await db.commit()
    await db.refresh(db_topic)

    return db_topic


# Обновляет название темы
async def update_topic(
    db: AsyncSession,
    topic_id: int,
    topic: schemas.TopicUpdate,
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


# Удаляет тему и отвязывает её от событий
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

    events_result = await db.execute(
        select(models.Event).filter(
            models.Event.topic_id == topic_id
        )
    )

    events = events_result.scalars().all()

    for event in events:
        event.topic_id = None

    await db.delete(db_topic)
    await db.commit()

    return True


# Получает задачи событий с возможностью фильтрации по статусу
async def get_event_tasks(
    db: AsyncSession,
    completed: Optional[bool] = None,
):
    query = select(models.EventTask)

    if completed is not None:
        query = query.filter(
            models.EventTask.completed == completed
        )

    result = await db.execute(query)
    return result.scalars().all()


# Создаёт задачу для события
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


# Обновляет статус задачи
async def update_event_task(
    db: AsyncSession,
    task_id: int,
    task_update: schemas.EventTaskUpdate,
):
    result = await db.execute(
        select(models.EventTask).filter(
            models.EventTask.id == task_id
        )
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


# Удаляет задачу события
async def delete_event_task(
    db: AsyncSession,
    task_id: int,
):
    result = await db.execute(
        select(models.EventTask).filter(
            models.EventTask.id == task_id
        )
    )
    db_task = result.scalars().first()

    if not db_task:
        return False

    await db.delete(db_task)
    await db.commit()

    return True


# Вычисляет ближайшую дату выполнения регулярного события
def calculate_next_due_date(
    start_date: date,
    periodicity: str,
    reference_date: date = None,
):
    if reference_date is None:
        reference_date = date.today()

    if reference_date < start_date:
        return start_date

    if periodicity == "ежегодно":
        try:
            next_date = start_date.replace(
                year=reference_date.year
            )
        except ValueError:
            # Для 29 февраля используем 28 февраля
            next_date = start_date.replace(
                year=reference_date.year,
                day=28,
            )

        if next_date < reference_date:
            try:
                next_date = start_date.replace(
                    year=reference_date.year + 1
                )
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

        next_date = start_date + timedelta(
            weeks=weeks_passed
        )

        if next_date < reference_date:
            next_date += timedelta(weeks=1)

        return next_date

    elif periodicity == "раз в квартал":
        months_diff = (
            (reference_date.year - start_date.year) * 12
            + reference_date.month
            - start_date.month
        )

        quarters_passed = months_diff // 3

        next_date = start_date + relativedelta(
            months=quarters_passed * 3
        )

        if next_date < reference_date:
            next_date += relativedelta(months=3)

        return next_date

    return None


# Создаёт страницу вместе с её элементами и ссылками
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

    for link in page_data.get(
        "links",
        [],
    ):
        db_link = models.PageLink(
            page_id=db_page.id,
            url=link["url"],
        )

        db.add(db_link)

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


# Получает текущую задачу события или создаёт её
async def get_or_create_current_task(
    db: AsyncSession,
    event_id: int,
):
    result = await db.execute(
        select(models.Event).filter(
            models.Event.id == event_id
        )
    )
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