from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app import crud, models
from app.database import engine, get_db
from app import schemas
from fastapi import Body
from datetime import date
from app.crud import get_or_create_current_task
from fastapi.middleware.cors import CORSMiddleware

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Карта актуальности API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.get("/projects", response_model=List[schemas.ProjectResponse])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = crud.get_projects(db, skip=skip, limit=limit)
    return projects

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db, project)

@app.get("/projects/{project_id}/pages", response_model=List[schemas.PageResponse])
def read_pages(project_id: int, db: Session = Depends(get_db)):
    pages = crud.get_pages_by_project(db, project_id)
    return pages

@app.post("/projects/{project_id}/pages", response_model=schemas.PageResponse)
def create_page(project_id: int, page: schemas.PageCreate, db: Session = Depends(get_db)):
    return crud.create_page(db, page, project_id)

@app.put("/pages/{page_id}", response_model=schemas.PageResponse)
def update_page(page_id: int, page: schemas.PageCreate, db: Session = Depends(get_db)):
    db_page = crud.update_page(db, page_id, page)
    if db_page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return db_page

@app.delete("/pages/{page_id}")
def delete_page(page_id: int, db: Session = Depends(get_db)):
    crud.delete_page(db, page_id)
    return {"ok": True}

@app.get("/pages/{page_id}/elements", response_model=List[schemas.ElementResponse])
def read_elements(page_id: int, db: Session = Depends(get_db)):
    return crud.get_elements_by_page(db, page_id)

@app.post("/pages/{page_id}/elements", response_model=schemas.ElementResponse)
def create_element(page_id: int, element: schemas.ElementCreate, db: Session = Depends(get_db)):
    return crud.create_element(db, element, page_id)

@app.get("/events", response_model=List[schemas.EventResponse])
def read_events(event_type: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_events(db, event_type)

@app.post("/events", response_model=schemas.EventResponse)
def create_event(
    event: schemas.EventCreate,
    element_ids: List[int] = Body(..., embed=True),  # передаём список id элементов
    db: Session = Depends(get_db)
):
    return crud.create_event(db, event, element_ids)

@app.get("/topics", response_model=List[schemas.TopicResponse])
def read_topics(db: Session = Depends(get_db)):
    return crud.get_topics(db)

@app.post("/topics", response_model=schemas.TopicResponse)
def create_topic(topic: schemas.TopicCreate, db: Session = Depends(get_db)):
    return crud.create_topic(db, topic)

@app.get("/tasks", response_model=List[schemas.EventTaskResponse])
def read_tasks(completed: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(models.EventTask)
    if completed is not None:
        query = query.filter(models.EventTask.completed == completed)
    tasks = query.all()
    
    # Добавляем флаг просрочки
    today = date.today()
    for task in tasks:
        task.is_overdue = not task.completed and task.due_date < today
    
    return tasks

@app.post("/tasks", response_model=schemas.EventTaskResponse)
def create_task(task: schemas.EventTaskCreate, db: Session = Depends(get_db)):
    return crud.create_event_task(db, task)

@app.put("/tasks/{task_id}", response_model=schemas.EventTaskResponse)
def update_task(task_id: int, task_update: schemas.EventTaskUpdate, db: Session = Depends(get_db)):
    task = crud.update_event_task(db, task_id, task_update)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    crud.delete_event_task(db, task_id)
    return {"ok": True}

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    success = crud.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True, "message": "Project deleted"}

@app.post("/elements/{element_id}/events/{event_id}")
def attach_event_to_element(element_id: int, event_id: int, db: Session = Depends(get_db)):
    crud.attach_event_to_element(db, element_id, event_id)
    return {"ok": True}

@app.post("/projects/{project_id}/pages_with_elements")
def create_page_with_elements(
    project_id: int, 
    page_data: dict, 
    db: Session = Depends(get_db)
):
    return crud.create_page_with_elements(db, page_data, project_id)

@app.get("/tasks/checklist", response_model=List[schemas.EventTaskResponse])
def get_checklist(db: Session = Depends(get_db)):
    """Получить все актуальные задания (с автоматическим созданием недостающих)"""
    events = db.query(models.Event).filter(models.Event.event_type == 'regular').all()
    tasks = []
    
    for event in events:
        task = get_or_create_current_task(db, event.id)
        if task:
            tasks.append(task)
    
    # Добавить нерегулярные события (у них задания создаются вручную)
    irregular_tasks = db.query(models.EventTask).join(models.Event).filter(
        models.Event.event_type == 'irregular'
    ).all()
    tasks.extend(irregular_tasks)
    
    return tasks