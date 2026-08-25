from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from pydantic import validator

class ProjectCreate(BaseModel):
    name: str

class ProjectResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class PageLinkCreate(BaseModel):
    url: str

class PageLinkResponse(BaseModel):
    id: int
    url: str

class PageCreate(BaseModel):
    title: str
    parent_page_id: Optional[int] = None
    links: Optional[List[PageLinkCreate]] = []

class PageResponse(BaseModel):
    id: int
    project_id: int
    parent_page_id: Optional[int]
    title: str
    sort_order: int
    links: List[PageLinkResponse] = []

    class Config:
        from_attributes = True

class ElementCreate(BaseModel):
    name: str
    parent_element_id: Optional[int] = None
    sort_order: Optional[int] = 0

class ElementResponse(BaseModel):
    id: int
    page_id: int
    parent_element_id: Optional[int]
    name: str
    sort_order: int

    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    name: str
    event_type: str  # 'regular' or 'irregular'
    periodicity: Optional[str] = None
    start_date: Optional[date] = None
    topic_id: Optional[int] = None

class EventResponse(BaseModel):
    id: int
    name: str
    event_type: str
    periodicity: Optional[str]
    start_date: Optional[date]
    topic_id: Optional[int]

    class Config:
        from_attributes = True

class TopicCreate(BaseModel):
    name: str

class EventTaskResponse(BaseModel):
    id: int
    event_id: int
    due_date: date
    completed: bool
    completed_at: Optional[datetime] = None
    is_overdue: Optional[bool] = False   # добавить это поле

    class Config:
        from_attributes = True

class EventTaskCreate(BaseModel):
    event_id: int
    due_date: date

class EventTaskResponse(BaseModel):
    id: int
    event_id: int
    due_date: date
    completed: bool
    completed_at: Optional[datetime]

class EventTaskUpdate(BaseModel):
    completed: bool

class TopicResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class ElementEventResponse(BaseModel):
    element_id: int
    event_id: int
    
    class Config:
        from_attributes = True