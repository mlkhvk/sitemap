from sqlalchemy.orm import Session
from app import models, schemas
from typing import List, Optional
from datetime import datetime
from sqlalchemy import func 
def get_projects(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Project).offset(skip).limit(limit).all()

def get_project(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def create_project(db: Session, project: schemas.ProjectCreate):
    db_project = models.Project(name=project.name)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def get_pages_by_project(db: Session, project_id: int):
    return db.query(models.Page).filter(models.Page.project_id == project_id).all()

def create_page(db: Session, page: schemas.PageCreate, project_id: int):
    parent_id = page.parent_page_id
    if parent_id == 0:
        parent_id = None
    
    # Если parent_id не указан, пытаемся определить по URL
    if parent_id is None and page.links and len(page.links) > 0:
        new_page_url = page.links[0].url
        
        # Ищем все страницы в этом проекте с их ссылками
        all_pages = db.query(models.Page, models.PageLink).join(
            models.PageLink, models.Page.id == models.PageLink.page_id
        ).filter(
            models.Page.project_id == project_id
        ).all()
        
        possible_parent = None
        max_len = 0
        
        for page_obj, link_obj in all_pages:
            # Проверяем, является ли URL ссылки родительским для нового URL
            if (len(link_obj.url) < len(new_page_url) and 
                new_page_url.startswith(link_obj.url + '/')):
                if len(link_obj.url) > max_len:
                    max_len = len(link_obj.url)
                    possible_parent = page_obj.id
        
        if possible_parent:
            parent_id = possible_parent
    
    db_page = models.Page(
        title=page.title,
        parent_page_id=parent_id,
        project_id=project_id
    )
    db.add(db_page)
    db.flush()
    
    for link in page.links:
        db_link = models.PageLink(
            page_id=db_page.id,
            url=link.url
        )
        db.add(db_link)
    
    db.commit()
    db.refresh(db_page)
    return db_page

def update_page(db: Session, page_id: int, page_update: schemas.PageCreate):
    db_page = db.query(models.Page).filter(models.Page.id == page_id).first()
    if not db_page:
        return None

    # Преобразуем 0 в None
    parent_id = page_update.parent_page_id
    if parent_id == 0:
        parent_id = None

    db_page.title = page_update.title
    db_page.parent_page_id = parent_id   # используем преобразованное значение

    # Обновление ссылок: удаляем старые, добавляем новые
    db.query(models.PageLink).filter(models.PageLink.page_id == page_id).delete()
    for link in page_update.links:
        db_link = models.PageLink(
            page_id=page_id,
            url=link.url
        )
        db.add(db_link)

    db.commit()
    db.refresh(db_page)
    return db_page

def delete_page(db: Session, page_id: int):
    db_page = db.query(models.Page).filter(models.Page.id == page_id).first()
    if db_page:
        db.delete(db_page)
        db.commit()

def get_elements_by_page(db: Session, page_id: int):
    return db.query(models.Element).filter(models.Element.page_id == page_id).all()

def create_element(db: Session, element: schemas.ElementCreate, page_id: int):
    db_element = models.Element(
        name=element.name,
        parent_element_id=element.parent_element_id,
        sort_order=element.sort_order,
        page_id=page_id
    )
    db.add(db_element)
    db.commit()
    db.refresh(db_element)
    return db_element

def get_events(db: Session, event_type: Optional[str] = None):
    query = db.query(models.Event)
    if event_type:
        query = query.filter(models.Event.event_type == event_type)
    return query.all()

def create_event(db: Session, event: schemas.EventCreate, element_ids: List[int]):
    # Создаём событие
    db_event = models.Event(
        name=event.name,
        event_type=event.event_type,
        periodicity=event.periodicity,
        start_date=event.start_date,
        topic_id=event.topic_id
    )
    db.add(db_event)
    db.flush()  # чтобы получить db_event.id

    # Привязываем к элементам
    for elem_id in element_ids:
        element = db.query(models.Element).get(elem_id)
        if not element:
            raise ValueError(f"Element {elem_id} not found")
        db_event.elements.append(element)

    db.commit()
    db.refresh(db_event)
    return db_event

def get_topics(db: Session):
    return db.query(models.Topic).all()

def create_topic(db: Session, topic: schemas.TopicCreate):
    db_topic = models.Topic(name=topic.name)
    db.add(db_topic)
    db.commit()
    db.refresh(db_topic)
    return db_topic

def get_event_tasks(db: Session, completed: Optional[bool] = None):
    query = db.query(models.EventTask)
    if completed is not None:
        query = query.filter(models.EventTask.completed == completed)
    return query.all()

def create_event_task(db: Session, task: schemas.EventTaskCreate):
    db_task = models.EventTask(event_id=task.event_id, due_date=task.due_date)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_event_task(db: Session, task_id: int, task_update: schemas.EventTaskUpdate):
    db_task = db.query(models.EventTask).filter(models.EventTask.id == task_id).first()
    if not db_task:
        return None
    db_task.completed = task_update.completed
    if task_update.completed:
        db_task.completed_at = datetime.utcnow()
    else:
        db_task.completed_at = None
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_event_task(db: Session, task_id: int):
    db_task = db.query(models.EventTask).filter(models.EventTask.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()

def attach_event_to_element(db: Session, element_id: int, event_id: int):
    exists = db.query(models.ElementEvent).filter(
        models.ElementEvent.element_id == element_id,
        models.ElementEvent.event_id == event_id
    ).first()
    if not exists:
        db_element_event = models.ElementEvent(element_id=element_id, event_id=event_id)
        db.add(db_element_event)
        db.commit()

from datetime import date, timedelta
from dateutil.relativedelta import relativedelta  

def calculate_next_due_date(start_date: date, periodicity: str, reference_date: date = None):
    """Вычисляет ближайшую дату выполнения, которая >= reference_date (или сегодня)"""
    if reference_date is None:
        reference_date = date.today()
    
    if reference_date < start_date:
        return start_date
    
    if periodicity == 'ежегодно':
        next_date = start_date.replace(year=reference_date.year)
        if next_date < reference_date:
            next_date = start_date.replace(year=reference_date.year + 1)
        return next_date
    
    elif periodicity == 'ежемесячно':
        next_date = start_date.replace(year=reference_date.year, month=reference_date.month)
        if next_date < reference_date:
            # Переход на следующий месяц
            next_date = next_date + relativedelta(months=1)
        return next_date
    
    elif periodicity == 'еженедельно':
        days_diff = (reference_date - start_date).days
        weeks_passed = days_diff // 7
        next_date = start_date + timedelta(weeks=weeks_passed)
        if next_date < reference_date:
            next_date = next_date + timedelta(weeks=1)
        return next_date
    
    elif periodicity == 'раз в квартал':
        # Упрощённо: каждые 3 месяца
        months_diff = (reference_date.year - start_date.year) * 12 + (reference_date.month - start_date.month)
        quarters_passed = months_diff // 3
        next_date = start_date + relativedelta(months=quarters_passed * 3)
        if next_date < reference_date:
            next_date = next_date + relativedelta(months=3)
        return next_date
    
    return None

def delete_project(db: Session, project_id: int):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if db_project:
        db.delete(db_project)
        db.commit()
        return True
    return False

def create_page_with_elements(db: Session, page_data: dict, project_id: int):
    # Создаём страницу
    db_page = models.Page(
        title=page_data['title'],
        project_id=project_id
    )
    db.add(db_page)
    db.flush()
    
    # Создаём ссылки
    for link in page_data.get('links', []):
        db_link = models.PageLink(page_id=db_page.id, url=link['url'])
        db.add(db_link)
    
    # Создаём элементы (рекурсивно)
    def create_elements(elements, parent_id=None):
        for el in elements:
            db_element = models.Element(
                page_id=db_page.id,
                parent_element_id=parent_id,
                name=el['name']
            )
            db.add(db_element)
            db.flush()
            if el.get('children'):
                create_elements(el['children'], db_element.id)
    
    create_elements(page_data.get('elements', []))
    
    db.commit()
    db.refresh(db_page)
    return db_page

def get_or_create_current_task(db: Session, event_id: int):
    """Возвращает задание для текущего периода или создаёт его, если пора"""
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event or event.event_type != 'regular':
        return None
    
    next_due_date = calculate_next_due_date(event.start_date, event.periodicity)
    
    if next_due_date is None:
        return None
    
    # Ищем существующее задание
    task = db.query(models.EventTask).filter(
        models.EventTask.event_id == event_id,
        models.EventTask.due_date == next_due_date
    ).first()
    
    # Если нет – создаём
    if not task:
        task = models.EventTask(
            event_id=event_id,
            due_date=next_due_date,
            completed=False
        )
        db.add(task)
        db.commit()
        db.refresh(task)
    
    return task