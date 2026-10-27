from sqlalchemy import (
    Column,
    BigInteger,
    Text,
    Integer,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    PrimaryKeyConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    name = Column(
        Text,
        nullable=False,
    )

    pages = relationship(
        "Page",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    topics = relationship(
        "Topic",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    events = relationship(
        "Event",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Page(Base):
    __tablename__ = "pages"

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    project_id = Column(
        BigInteger,
        ForeignKey(
            "projects.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    parent_page_id = Column(
        BigInteger,
        ForeignKey(
            "pages.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    title = Column(
        Text,
        nullable=False,
    )

    sort_order = Column(
        Integer,
        default=0,
        nullable=False,
    )

    project = relationship(
        "Project",
        back_populates="pages",
    )

    parent = relationship(
        "Page",
        remote_side=[id],
        back_populates="children",
    )

    children = relationship(
        "Page",
        back_populates="parent",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    links = relationship(
        "PageLink",
        back_populates="page",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    elements = relationship(
        "Element",
        back_populates="page",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )


class PageLink(Base):
    __tablename__ = "page_links"

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    page_id = Column(
        BigInteger,
        ForeignKey(
            "pages.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    url = Column(
        Text,
        nullable=False,
    )

    page = relationship(
        "Page",
        back_populates="links",
    )


class Element(Base):
    __tablename__ = "elements"

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    page_id = Column(
        BigInteger,
        ForeignKey(
            "pages.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    parent_element_id = Column(
        BigInteger,
        ForeignKey(
            "elements.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    name = Column(
        Text,
        nullable=False,
    )

    sort_order = Column(
        Integer,
        default=0,
        nullable=False,
    )

    page = relationship(
        "Page",
        back_populates="elements",
    )

    parent = relationship(
        "Element",
        remote_side=[id],
        back_populates="children",
    )

    children = relationship(
        "Element",
        back_populates="parent",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    element_events = relationship(
        "ElementEvent",
        back_populates="element",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    events = relationship(
        "Event",
        secondary="element_events",
        back_populates="elements",
        viewonly=True,
    )


class Topic(Base):
    __tablename__ = "topics"

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    name = Column(
        Text,
        nullable=False,
    )

    project_id = Column(
        BigInteger,
        ForeignKey(
            "projects.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    project = relationship(
        "Project",
        back_populates="topics",
    )

    events = relationship(
        "Event",
        back_populates="topic",
    )


class Event(Base):
    __tablename__ = "events"

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('regular', 'irregular')",
            name="check_event_type",
        ),
        CheckConstraint(
            """
            periodicity IN (
                'еженедельно',
                'ежемесячно',
                'раз в квартал',
                'ежегодно'
            )
            OR periodicity IS NULL
            """,
            name="check_periodicity",
        ),
        CheckConstraint(
            """
            (
                event_type = 'regular'
                AND start_date IS NOT NULL
                AND periodicity IS NOT NULL
            )
            OR
            (
                event_type = 'irregular'
                AND start_date IS NULL
                AND periodicity IS NULL
            )
            """,
            name="event_type_constraint",
        ),
    )

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    name = Column(
        Text,
        nullable=False,
    )

    project_id = Column(
        BigInteger,
        ForeignKey(
            "projects.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    event_type = Column(
        Text,
        nullable=False,
    )

    periodicity = Column(
        Text,
        nullable=True,
    )

    start_date = Column(
        Date,
        nullable=True,
    )

    # Описание нерегулярного события
    description = Column(
        Text,
        nullable=True,
    )

    topic_id = Column(
        BigInteger,
        ForeignKey(
            "topics.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    project = relationship(
        "Project",
        back_populates="events",
    )

    topic = relationship(
        "Topic",
        back_populates="events",
    )

    element_events = relationship(
        "ElementEvent",
        back_populates="event",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    elements = relationship(
        "Element",
        secondary="element_events",
        back_populates="events",
        viewonly=True,
    )

    tasks = relationship(
        "EventTask",
        back_populates="event",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ElementEvent(Base):
    __tablename__ = "element_events"

    __table_args__ = (
        PrimaryKeyConstraint(
            "element_id",
            "event_id",
            name="element_events_pkey",
        ),
    )

    element_id = Column(
        BigInteger,
        ForeignKey(
            "elements.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        nullable=False,
    )

    event_id = Column(
        BigInteger,
        ForeignKey(
            "events.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        nullable=False,
    )

    element = relationship(
        "Element",
        back_populates="element_events",
    )

    event = relationship(
        "Event",
        back_populates="element_events",
    )


class EventTask(Base):
    __tablename__ = "event_tasks"

    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "due_date",
            name="idx_event_tasks_unique_event_due",
        ),
    )

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    event_id = Column(
        BigInteger,
        ForeignKey(
            "events.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    due_date = Column(
        Date,
        nullable=False,
    )

    completed = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    event = relationship(
        "Event",
        back_populates="tasks",
    )