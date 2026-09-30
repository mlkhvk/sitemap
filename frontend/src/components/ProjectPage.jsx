import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import {
  useParams,
  useNavigate,
} from 'react-router-dom';

import {
  Menu,
  Undo2,
  Pencil,
  Trash2,
  X,
  Search,
} from 'lucide-react';

import AddPageModal from './AddPageModal';
import ChecklistsSection from './Checklist';
import PdfGenerationSection from './PdfGenerationSection';

import colors from '../colors';

import {
  getPages,
  getProjects,
  createPage,
  updatePage,
  deletePage,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventElementsByEvent,
  getElements,
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} from '../services/api';

import {
  isIrregularEvent,
  getEventTitle,
  getEventDate,
  getEventRecurrence,
  RECURRENCE_LABELS,
  RU_MONTHS_GENITIVE,
  parseMonthDay,
  compareMonthDay,
} from '../utils/eventHelpers';

// Загружает данные выбранного проекта
function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);

  const pagesSectionRef = useRef(null);
  const sitemapSectionRef = useRef(null);
  const eventsSectionRef = useRef(null);
  const checklistsSectionRef = useRef(null);
  const pdfSectionRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [topics, setTopics] = useState([]);

  const [regularSearch, setRegularSearch] = useState('');
  const [irregularSearch, setIrregularSearch] = useState('');

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventModalMode, setEventModalMode] = useState('regular');

  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);

  // Загружает проект, страницы, события и темы
  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);

      const projectsRes = await getProjects();

      const foundProject = projectsRes.data.find(
        (project) => project.id === Number(projectId)
      );

      setProject(foundProject);

      const pagesRes = await getPages(projectId);

      setPages(pagesRes.data || []);

      const eventsRes = await getEvents(projectId);

      setEvents(eventsRes.data || []);

      const topicsRes = await getTopics(projectId);

      setTopics(topicsRes.data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Нормализует ссылку страницы до единого формата
  const normalizePath = (rawUrl) => {
    if (!rawUrl) {
      return '';
    }

    let path;

    try {
      const parsed =
        /^https?:\/\//i.test(String(rawUrl))
          ? new URL(rawUrl)
          : new URL(
              rawUrl,
              'http://dummy.local'
            );

      path = parsed.pathname;
    } catch {
      path = rawUrl;
    }

    path = `/${String(path || '')}`
      .replace(/\/+/g, '/')
      .toLowerCase();

    if (path.length > 1) {
      path = path.replace(/\/+$/, '');
    }

    return path || '/';
  };

  // Получает путь первой ссылки страницы
  const getPagePath = (page) => {
    const firstLink = page.links?.[0]?.url;

    return normalizePath(firstLink);
  };

  // Проверяет, является ли один путь вложенным относительно другого
  const isDescendantPath = (
    parentPath,
    childPath
  ) => {
    if (
      !parentPath ||
      !childPath ||
      parentPath === childPath
    ) {
      return false;
    }

    if (parentPath === '/') {
      const childSegments = childPath
        .split('/')
        .filter(Boolean);

      return childSegments.length >= 2;
    }

    return childPath.startsWith(
      `${parentPath}/`
    );
  };

  // Строит дерево страниц по их ссылкам
  const buildPageTree = (pageList) => {
    const items = pageList.map(
      (page) => ({
        ...page,
        children: [],
        _path: getPagePath(page),
      })
    );

    const tree = [];

    items.forEach((item) => {
      if (!item._path) {
        tree.push(item);
        return;
      }

      let bestParent = null;

      items.forEach((candidate) => {
        if (candidate === item) {
          return;
        }

        if (!candidate._path) {
          return;
        }

        if (
          candidate._path ===
          item._path
        ) {
          return;
        }

        const isNested =
          isDescendantPath(
            candidate._path,
            item._path
          );

        if (!isNested) {
          return;
        }

        if (
          !bestParent ||
          candidate._path.length >
            bestParent._path.length
        ) {
          bestParent = candidate;
        }
      });

      if (bestParent) {
        bestParent.children.push(item);
      } else {
        tree.push(item);
      }
    });

    return tree;
  };

  // Отображает дерево карты сайта
  const renderSitemap = (
    pageList,
    level = 0
  ) => {
    const sortedPages = [
      ...pageList,
    ].sort((a, b) => {
      if (
        a.sort_order !== undefined &&
        b.sort_order !== undefined
      ) {
        return (
          a.sort_order -
          b.sort_order
        );
      }

      return a.title.localeCompare(
        b.title
      );
    });

    return sortedPages.map(
      (page) => {
        const hasChildren =
          page.children &&
          page.children.length > 0;

        const isRoot =
          level === 0;

        return (
          <div key={page.id}>
            <div
              className="py-1 flex items-center"
              style={{
                paddingLeft:
                  `${level * 20}px`,
                color:
                  colors.primary,
              }}
            >
              {!isRoot && (
                <span
                  style={{
                    marginRight:
                      '8px',
                  }}
                >
                  •
                </span>
              )}

              <span
                style={{
                  fontSize: isRoot
                    ? '20px'
                    : '18px',
                  fontWeight: isRoot
                    ? '600'
                    : '400',
                  color:
                    colors.primary,
                }}
              >
                {page.title}
              </span>
            </div>

            {hasChildren && (
              <div>
                {renderSitemap(
                  page.children,
                  level + 1
                )}
              </div>
            )}
          </div>
        );
      }
    );
  };

  // Нормализует значение для поиска
  const normalizeSearchValue = (value) => {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  };

  // Получает название темы события
  const getEventTopicName = (
    event,
    topicList
  ) => {
    return (
      event.topic?.name ??
      topicList.find(
        (topic) =>
          topic.id === event.topic_id
      )?.name ??
      ''
    );
  };

  // Формирует варианты даты для поиска
  const getDateSearchValues = (date) => {
    if (!date) {
      return [];
    }

    const value = String(date);
    const { month, day } = parseMonthDay(value);

    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');

    const values = [
      value,
      `${paddedDay}.${paddedMonth}`,
      `${day}.${month}`,
      `${paddedDay}.${paddedMonth}.${value.split('-')[0] ?? ''}`,
      `${day}.${month}.${value.split('-')[0] ?? ''}`,
      `${value.split('-')[0] ?? ''}.${paddedMonth}.${paddedDay}`,
      `${value.split('-')[0] ?? ''}.${month}.${day}`,
      `${paddedMonth}-${paddedDay}`,
      `${day}-${month}`,
      `${paddedDay}/${paddedMonth}`,
      `${day}/${month}`,
      `${paddedDay} ${RU_MONTHS_GENITIVE[month - 1] ?? ''}`,
      `${day} ${RU_MONTHS_GENITIVE[month - 1] ?? ''}`,
    ];

    return values
      .map(normalizeSearchValue)
      .filter(Boolean);
  };

  // Проверяет совпадение значения с поисковым запросом
  const matchesSearchValue = (
    values,
    term
  ) => {
    const normalizedTerm =
      normalizeSearchValue(term);

    if (!normalizedTerm) {
      return true;
    }

    return values.some((value) =>
      normalizeSearchValue(value).includes(
        normalizedTerm
      )
    );
  };

  // Проверяет регулярное событие по поиску
  const matchesRegularSearch = (
    event,
    term
  ) => {
    const normalizedTerm =
      normalizeSearchValue(term);

    if (!normalizedTerm) {
      return true;
    }

    const title = getEventTitle(event);
    const date = getEventDate(event);
    const recurrence =
      getEventRecurrence(event);

    const recurrenceLabel =
      RECURRENCE_LABELS[recurrence] ??
      recurrence ??
      '';

    return (
      matchesSearchValue(
        [title],
        normalizedTerm
      ) ||
      matchesSearchValue(
        getDateSearchValues(date),
        normalizedTerm
      ) ||
      matchesSearchValue(
        [recurrence, recurrenceLabel],
        normalizedTerm
      )
    );
  };

  // Проверяет нерегулярное событие по поиску
  const matchesIrregularSearch = (
    event,
    term,
    topicList
  ) => {
    const normalizedTerm =
      normalizeSearchValue(term);

    if (!normalizedTerm) {
      return true;
    }

    const title = getEventTitle(event);

    const topicName =
      getEventTopicName(
        event,
        topicList
      );

    return (
      matchesSearchValue(
        [title],
        normalizedTerm
      ) ||
      matchesSearchValue(
        [topicName],
        normalizedTerm
      )
    );
  };

  // Формирует группы регулярных событий
  const getRegularGroups =
    useCallback(() => {
      const filtered =
        events.filter(
          (event) =>
            !isIrregularEvent(event) &&
            matchesRegularSearch(
              event,
              regularSearch
            )
        );

      const groups = {};

      filtered.forEach((event) => {
        const date =
          getEventDate(event);

        const recurrence =
          getEventRecurrence(event);

        if (
          !date ||
          !recurrence
        ) {
          return;
        }

        const key =
          `${date}_${recurrence}`;

        if (!groups[key]) {
          groups[key] = {
            date,
            recurrence,
            items: [],
          };
        }

        groups[key].items.push(event);
      });

      return Object.values(groups).sort(
        (a, b) =>
          compareMonthDay(
            a.date,
            b.date
          )
      );
    }, [
      events,
      regularSearch,
    ]);

  // Формирует группы нерегулярных событий
  const getIrregularGroups =
    useCallback(() => {
      const filtered =
        events.filter(
          (event) =>
            isIrregularEvent(event) &&
            matchesIrregularSearch(
              event,
              irregularSearch,
              topics
            )
        );

      const groups = {};

      filtered.forEach((event) => {
        const key =
          event.topic_id ?? 'none';

        const topicName =
          getEventTopicName(
            event,
            topics
          ) || 'Без темы';

        if (!groups[key]) {
          groups[key] = {
            name: topicName,
            items: [],
          };
        }

        groups[key].items.push(event);
      });

      return Object.values(groups).sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      );
    }, [
      events,
      irregularSearch,
      topics,
    ]);

  // Удаляет событие
  const handleDeleteEvent = async (
    eventId,
    clickEvent
  ) => {
    clickEvent?.stopPropagation();

    const confirmed =
      window.confirm(
        'Вы уверены, что хотите удалить это событие?'
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteEvent(eventId);

      setEvents((prevEvents) =>
        prevEvents.filter(
          (event) =>
            event.id !== eventId
        )
      );
    } catch (error) {
      alert(
        error.message ||
        'Не удалось удалить событие'
      );
    }
  };

  // Отображает регулярные события
  const renderRegularEvents = () => {
    const groups =
      getRegularGroups();

    if (groups.length === 0) {
      return (
        <div
          className="text-center py-6"
          style={{
            color:
              colors.secondaryText,
          }}
        >
          Нет регулярных событий
        </div>
      );
    }

    return groups.map((group) => {
      const {
        day,
        month,
      } = parseMonthDay(
        group.date
      );

      const monthName =
        RU_MONTHS_GENITIVE[
          month - 1
        ] || '';

      const recurrenceLabel =
        RECURRENCE_LABELS[
          group.recurrence
        ] ||
        group.recurrence ||
        '';

      return (
        <div
          key={`${group.date}-${group.recurrence}`}
          className="mb-5"
        >
          <div
            className="text-lg font-semibold"
            style={{
              color:
                colors.black,
            }}
          >
            {day}{' '}
            {monthName}{' '}
            —{' '}
            {recurrenceLabel}
          </div>

          <ul className="mt-1">
            {group.items.map(
              (event) => (
                <li
                  key={event.id}
                  className="flex items-center gap-2 py-0.5"
                  style={{
                    paddingLeft:
                      '20px',
                    color:
                      colors.primary,
                  }}
                >
                  <span>•</span>

                  <span>
                    {getEventTitle(event)}
                  </span>

                  <button
                    type="button"
                    onClick={(
                      clickEvent
                    ) =>
                      handleOpenEditEvent(
                        event,
                        clickEvent
                      )
                    }
                    className="p-1 rounded hover:text-blue-600 transition cursor-pointer"
                    title="Редактировать событие"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={(
                      clickEvent
                    ) =>
                      handleDeleteEvent(
                        event.id,
                        clickEvent
                      )
                    }
                    className="p-1 rounded hover:text-red-500 transition cursor-pointer"
                    title="Удалить событие"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      );
    });
  };

  // Отображает нерегулярные события
  const renderIrregularEvents = () => {
    const groups =
      getIrregularGroups();

    if (groups.length === 0) {
      return (
        <div
          className="text-center py-6"
          style={{
            color:
              colors.secondaryText,
          }}
        >
          Нет нерегулярных событий
        </div>
      );
    }

    return groups.map(
      (group, index) => (
        <div
          key={index}
          className="mb-4"
        >
          <div
            className="text-lg font-semibold"
            style={{
              color:
                colors.black,
            }}
          >
            {group.name}:
          </div>

          <ul className="mt-1">
            {group.items.map(
              (event) => (
                <li
                  key={event.id}
                  className="flex items-center gap-2 py-0.5"
                  style={{
                    paddingLeft:
                      '20px',
                    color:
                      colors.primary,
                  }}
                >
                  <span>•</span>

                  <span>
                    {getEventTitle(event)}
                  </span>

                  <button
                    type="button"
                    onClick={(
                      clickEvent
                    ) =>
                      handleOpenEditEvent(
                        event,
                        clickEvent
                      )
                    }
                    className="p-1 rounded hover:text-blue-600 transition cursor-pointer"
                    title="Редактировать событие"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={(
                      clickEvent
                    ) =>
                      handleDeleteEvent(
                        event.id,
                        clickEvent
                      )
                    }
                    className="p-1 rounded hover:text-red-500 transition cursor-pointer"
                    title="Удалить событие"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      )
    );
  };

  // Открывает редактирование события
  const handleOpenEditEvent = (
    event,
    clickEvent
  ) => {
    clickEvent?.stopPropagation();

    setEditingEvent(event);

    setEventModalMode(
      isIrregularEvent(event)
        ? 'irregular'
        : 'regular'
    );

    setIsEventModalOpen(true);
  };

  // Открывает создание события
  const handleOpenCreateEvent = (
    mode
  ) => {
    setEditingEvent(null);
    setEventModalMode(mode);
    setIsEventModalOpen(true);
  };

  // Закрывает модальное окно события
  const handleEventModalClose =
    async (
      shouldRefresh = false
    ) => {
      setIsEventModalOpen(false);

      if (shouldRefresh) {
        await fetchProjectData();
      }
    };

  // Закрывает модальное окно тем
  const handleTopicModalClose = () => {
    setIsTopicModalOpen(false);
  };

  // Обновляет список тем и событий
  const handleTopicChanged =
    async () => {
      try {
        const [
          topicsRes,
          eventsRes,
        ] = await Promise.all([
          getTopics(projectId),
          getEvents(projectId),
        ]);

        setTopics(
          topicsRes.data || []
        );

        setEvents(
          eventsRes.data || []
        );
      } catch {
      }
    };

  // Открывает создание страницы
  const handleOpenCreate = () => {
    setEditingPage(null);
    setIsAddModalOpen(true);
  };

  // Открывает редактирование страницы
  const handleEditPage = (page) => {
    setEditingPage(page);
    setIsAddModalOpen(true);
  };

  // Закрывает модальное окно страницы
  const handleModalClose =
    async (
      shouldRefresh = false
    ) => {
      setIsAddModalOpen(false);
      setEditingPage(null);

      if (shouldRefresh) {
        await fetchProjectData();
      }
    };

  // Удаляет страницу
  const handleDeletePage =
    async (
      pageId,
      event
    ) => {
      event.stopPropagation();

      const confirmed =
        window.confirm(
          'Вы уверены, что хотите удалить эту страницу?'
        );

      if (!confirmed) {
        return;
      }

      try {
        await deletePage(pageId);
        await fetchProjectData();
      } catch {
        alert(
          'Не удалось удалить страницу'
        );
      }
    };

  // Открывает или закрывает боковую панель
  const toggleSidebar = () => {
    setIsSidebarOpen(
      (prev) => !prev
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Загрузка...
      </div>
    );
  }

  const pageTree =
    buildPageTree(pages);

  return (
    <div className="min-h-screen p-3">
      <div
        className="rounded-2xl overflow-hidden border min-h-[95vh] relative"
        style={{
          borderColor:
            colors.lightGray,
        }}
      >
        <aside
          className={`fixed left-3 top-3 h-[calc(100vh-1.5rem)] z-10 transition-all duration-300 overflow-hidden ${
            isSidebarOpen
              ? 'w-[320px]'
              : 'w-0'
          } border rounded-2xl`}
          style={{
            borderColor:
              colors.lightGray,
            backgroundColor:
              colors.blue,
          }}
        >
          <div className="w-[320px] h-full flex flex-col">
            <div className="px-5 pt-5 flex items-center gap-4">
              <button
                onClick={
                  toggleSidebar
                }
              >
                <Menu
                  size={28}
                  className="text-black"
                />
              </button>

              <button
                onClick={() =>
                  navigate('/')
                }
              >
                <Undo2
                  size={28}
                  className="text-black"
                />
              </button>
            </div>

            <div
              className="mt-8 px-4 text-xl"
              style={{
                color:
                  colors.primary,
              }}
            >
              <div className="font-semibold mb-2">
                Структура сайта
              </div>

              <ul className="space-y-2 text-xl">
                <li
                  className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() =>
                    pagesSectionRef.current?.scrollIntoView(
                      {
                        behavior:
                          'smooth',
                        block:
                          'start',
                      }
                    )
                  }
                >
                  <span>•</span>
                  <span>Страницы</span>
                </li>

                <li
                  className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() =>
                    sitemapSectionRef.current?.scrollIntoView(
                      {
                        behavior:
                          'smooth',
                        block:
                          'start',
                      }
                    )
                  }
                >
                  <span>•</span>
                  <span>Карта</span>
                </li>

                <li
                  className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() =>
                    eventsSectionRef.current?.scrollIntoView(
                      {
                        behavior:
                          'smooth',
                        block:
                          'start',
                      }
                    )
                  }
                >
                  <span>•</span>
                  <span>События</span>
                </li>

                <li
                  className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() =>
                    checklistsSectionRef.current?.scrollIntoView(
                      {
                        behavior:
                          'smooth',
                        block:
                          'start',
                      }
                    )
                  }
                >
                  <span>•</span>
                  <span>Чеклисты</span>
                </li>
                <div className="mt-5 font-semibold text-xl">
                  Результат
                </div>
                <li
                  className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() =>
                    pdfSectionRef.current?.scrollIntoView(
                      {
                        behavior:
                          'smooth',
                        block:
                          'start',
                      }
                    )
                  }
                >
                  <span>•</span>
                  <span>Генерация PDF</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {!isSidebarOpen && (
          <div className="fixed left-3 top-3 z-10 flex items-center gap-2">
            <button
              onClick={
                toggleSidebar
              }
              className="p-2 rounded-lg"
            >
              <Menu
                size={28}
                className="text-black"
              />
            </button>

            <button
              onClick={() =>
                navigate('/')
              }
              className="rounded-lg"
            >
              <Undo2
                size={28}
                className="text-black"
              />
            </button>
          </div>
        )}

        <div
          className="h-[70px] flex items-center justify-center px-10 border-b w-full"
          style={{
            borderBottomColor:
              colors.lightGray,
            backgroundColor:
              colors.background,
          }}
        >
          <h1
            className="text-2xl font-semibold"
            style={{
              color:
                colors.primary,
            }}
          >
            {project?.name}
          </h1>
        </div>

        <main
          className={`flex-1 flex flex-col transition-all duration-300 ${
            isSidebarOpen
              ? 'ml-[340px]'
              : 'ml-[70px]'
          }`}
        >
          <div className="mt-10">
            <div
              ref={pagesSectionRef}
              className="scroll-mt-24 w-full max-w-[720px] mx-auto mb-7 grid grid-cols-3 items-center"
            >
              <div />

              <div className="flex justify-center">
                <h2 className="text-2xl font-semibold text-black">
                  Страницы сайта
                </h2>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={
                    handleOpenCreate
                  }
                  className="text-white font-semibold text-lg px-4 py-1.5 rounded-xl"
                  style={{
                    backgroundColor:
                      colors.primary,
                  }}
                >
                  + Добавить страницу
                </button>
              </div>
            </div>

            <div className="w-full max-w-[720px] mx-auto">
              <table
                className="w-full border border-collapse bg-white"
                style={{
                  borderColor:
                    colors.lightGray,
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor:
                        '#eef2f6',
                    }}
                  >
                    <th
                      className="border px-4 py-3 text-xl font-semibold text-left w-[240px]"
                      style={{
                        borderColor:
                          colors.lightGray,
                        color:
                          colors.primary,
                      }}
                    >
                      Название
                    </th>

                    <th
                      className="border px-4 py-3 text-xl font-semibold text-left"
                      style={{
                        borderColor:
                          colors.lightGray,
                        color:
                          colors.primary,
                      }}
                    >
                      Ссылки
                    </th>

                    <th
                      className="border w-[44px]"
                      style={{
                        borderColor:
                          colors.lightGray,
                      }}
                    />

                    <th
                      className="border w-[44px]"
                      style={{
                        borderColor:
                          colors.lightGray,
                      }}
                    />
                  </tr>
                </thead>

                <tbody>
                  {pages.map(
                    (page) => (
                      <tr
                        key={
                          page.id
                        }
                      >
                        <td
                          className="border px-4 py-3 text-lg"
                          style={{
                            borderColor:
                              colors.lightGray,
                            color:
                              colors.primary,
                          }}
                        >
                          <button
                            onClick={() =>
                              navigate(
                                `/project/${projectId}/page/${page.id}`
                              )
                            }
                            className="hover:text-blue-600 hover:underline transition-colors cursor-pointer text-left w-full"
                            style={{
                              color:
                                colors.primary,
                            }}
                          >
                            {
                              page.title
                            }
                          </button>
                        </td>

                        <td
                          className="border px-4 py-3 text-lg"
                          style={{
                            borderColor:
                              colors.lightGray,
                            color:
                              colors.primary,
                          }}
                        >
                          {page.links?.map(
                            (
                              link,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                              >
                                {
                                  link.url
                                }
                              </div>
                            )
                          )}
                        </td>

                        <td
                          className="border text-center"
                          style={{
                            borderColor:
                              colors.lightGray,
                          }}
                        >
                          <button
                            onClick={() =>
                              handleEditPage(
                                page
                              )
                            }
                            className="hover:text-blue-600 transition"
                          >
                            <Pencil
                              size={18}
                            />
                          </button>
                        </td>

                        <td
                          className="border text-center"
                          style={{
                            borderColor:
                              colors.lightGray,
                          }}
                        >
                          <button
                            className="hover:text-red-500 transition"
                            onClick={(
                              event
                            ) =>
                              handleDeletePage(
                                page.id,
                                event
                              )
                            }
                          >
                            <Trash2
                              size={18}
                            />
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {pages.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="text-center py-6"
                        style={{
                          color:
                            colors.secondaryText,
                        }}
                      >
                        Нет добавленных страниц
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              ref={
                sitemapSectionRef
              }
              className="scroll-mt-24 mt-10 w-full max-w-[720px] mx-auto"
            >
              <h2 className="text-2xl font-semibold mb-6 text-center text-black">
                Карта сайта
              </h2>

              <div
                className="border rounded-lg p-6"
                style={{
                  borderColor:
                    colors.lightGray,
                }}
              >
                {pages.length === 0 ? (
                  <div
                    className="text-center py-8"
                    style={{
                      color:
                        colors.secondaryText,
                    }}
                  >
                    Нет страниц для отображения карты сайта
                  </div>
                ) : (
                  <div>
                    {renderSitemap(
                      pageTree
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              ref={
                eventsSectionRef
              }
              className="scroll-mt-24 mt-10 w-full max-w-[720px] mx-auto pb-16"
            >
              <h2 className="text-2xl font-semibold mb-8 text-center text-black">
                События
              </h2>

              <div className="mb-12">
                <h3
                  className="text-xl font-semibold mb-2"
                  style={{
                    color:
                      colors.primary,
                  }}
                >
                  Регулярные
                </h3>

                <hr
                  className="mb-4"
                  style={{
                    borderColor:
                      colors.lightGray,
                  }}
                />

                <p
                  className="text-base mb-4"
                  style={{
                    color:
                      colors.text,
                  }}
                >
                  Чеклисты, привязанные
                  к конкретным регулярным
                  событиям, которые можно
                  обозначить датой. Каждая
                  дата коротко пояснена
                  сутью обновлений.
                </p>

                <hr
                  className="mb-4"
                  style={{
                    borderColor:
                      colors.lightGray,
                  }}
                />

                <div className="flex gap-3 mb-8">
                  <button
                    onClick={() =>
                      handleOpenCreateEvent(
                        'regular'
                      )
                    }
                    className="text-white font-semibold px-4 py-1.5 rounded-xl"
                    style={{
                      backgroundColor:
                        colors.primary,
                    }}
                  >
                    + Добавить
                  </button>
                </div>

                <div className="grid grid-cols-3 items-center mb-4">
                  <div />

                  <h4 className="text-xl font-semibold text-center text-black">
                    Список событий
                  </h4>

                  <div className="flex justify-end">
                    <input
                      type="text"
                      placeholder="Поиск..."
                      value={
                        regularSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setRegularSearch(
                          event.target
                            .value
                        )
                      }
                      className="border rounded-md px-2 py-1 text-sm w-32"
                      style={{
                        borderColor:
                          colors.lightGray,
                      }}
                    />
                  </div>
                </div>

                <div>
                  {renderRegularEvents()}
                </div>
              </div>

              <div>
                <h3
                  className="text-xl font-semibold mb-2"
                  style={{
                    color:
                      colors.primary,
                  }}
                >
                  Нерегулярные
                </h3>

                <hr
                  className="mb-4"
                  style={{
                    borderColor:
                      colors.lightGray,
                  }}
                />

                <p
                  className="text-base mb-4"
                  style={{
                    color:
                      colors.text,
                  }}
                >
                  Чеклисты, привязанные
                  к конкретным событиям,
                  которые могут произойти
                  когда-угодно. Для каждого
                  события коротко пояснена
                  суть изменений.
                </p>

                <hr
                  className="mb-4"
                  style={{
                    borderColor:
                      colors.lightGray,
                  }}
                />

                <div className="flex gap-3 mb-8">
                  <button
                    onClick={() =>
                      handleOpenCreateEvent(
                        'irregular'
                      )
                    }
                    className="text-white font-semibold px-4 py-1.5 rounded-xl"
                    style={{
                      backgroundColor:
                        colors.primary,
                    }}
                  >
                    + Добавить
                  </button>

                  <button
                    onClick={() =>
                      setIsTopicModalOpen(
                        true
                      )
                    }
                    className="font-semibold px-4 py-1.5 rounded-xl border"
                    style={{
                      borderColor:
                        colors.primary,
                      color:
                        colors.primary,
                    }}
                  >
                    Темы
                  </button>
                </div>

                <div className="grid grid-cols-3 items-center mb-4">
                  <div />

                  <h4 className="text-xl font-semibold text-center text-black">
                    Список событий
                  </h4>

                  <div className="flex justify-end">
                    <input
                      type="text"
                      placeholder="Поиск..."
                      value={
                        irregularSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setIrregularSearch(
                          event.target
                            .value
                        )
                      }
                      className="border rounded-md px-2 py-1 text-sm w-32"
                      style={{
                        borderColor:
                          colors.lightGray,
                      }}
                    />
                  </div>
                </div>

                <div>
                  {renderIrregularEvents()}
                </div>
              </div>
            </div>

            <div
              ref={checklistsSectionRef}
              className="scroll-mt-24 mt-10 w-full max-w-[720px] mx-auto pb-16"
            >
              <h2 className="text-2xl font-semibold mb-6 text-center text-black">
                Чеклисты
              </h2>

              <ChecklistsSection
                projectId={projectId}
                pages={pages}
              />
            </div>

            <div
              ref={pdfSectionRef}
              className="scroll-mt-24 mt-10 w-full max-w-[720px] mx-auto pb-16"
            >
              <PdfGenerationSection
                project={project}
                pages={pages}
                pageTree={pageTree}
                events={events}
                topics={topics}
              />
            </div>
          </div>
        </main>
      </div>

      <AddPageModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        onSavePage={createPage}
        onUpdatePage={updatePage}
        editingPage={editingPage}
      />

      <EventModal
        isOpen={isEventModalOpen}
        onClose={handleEventModalClose}
        mode={eventModalMode}
        projectId={projectId}
        topics={topics}
        pages={pages}
        editingEvent={editingEvent}
      />

      <TopicModal
        projectId={projectId}
        isOpen={isTopicModalOpen}
        onClose={handleTopicModalClose}
        topics={topics}
        onChanged={handleTopicChanged}
      />
    </div>
  );
}

// Управляет модальным окном создания и редактирования события
function EventModal({
  isOpen,
  onClose,
  mode,
  projectId,
  topics,
  pages,
  editingEvent,
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [recurrence, setRecurrence] =
    useState('ежегодно');
  const [topicId, setTopicId] =
    useState('');
  const [saving, setSaving] =
    useState(false);

  const [pageElements, setPageElements] =
    useState([]);
  const [elementSearch, setElementSearch] =
    useState('');
  const [selectedElementIds, setSelectedElementIds] =
    useState([]);
  const [loadingElements, setLoadingElements] =
    useState(false);
  const [error, setError] =
    useState('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadEditingEvent = async () => {
      setError('');
      setElementSearch('');

      if (!editingEvent) {
        setTitle('');
        setDate('');
        setRecurrence('ежегодно');
        setTopicId('');
        setSelectedElementIds([]);
        return;
      }

      setTitle(
        editingEvent.name ??
        editingEvent.title ??
        ''
      );

      setDate(
        getEventDate(editingEvent) ||
        editingEvent.start_date ||
        ''
      );

      setRecurrence(
        getEventRecurrence(editingEvent) ||
        'ежегодно'
      );

      setTopicId(
        editingEvent.topic_id !== null &&
        editingEvent.topic_id !== undefined
          ? String(
              editingEvent.topic_id
            )
          : ''
      );

      try {
        const response =
          await getEventElementsByEvent(
            editingEvent.id
          );

        const ids = (
          response.data || []
        )
          .map(
            (item) =>
              item.element_id ??
              item.id
          )
          .filter(
            (id) =>
              id !== null &&
              id !== undefined
          )
          .map(Number);

        if (!cancelled) {
          setSelectedElementIds(
            ids
          );
        }
      } catch {
        if (!cancelled) {
          setSelectedElementIds([]);
          setError(
            'Не удалось загрузить элементы, к которым привязано событие'
          );
        }
      }
    };

    loadEditingEvent();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    mode,
    editingEvent,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadElements = async () => {
      setLoadingElements(true);
      setError('');

      try {
        const results =
          await Promise.all(
            (pages || []).map(
              async (page) => {
                try {
                  const response =
                    await getElements(
                      page.id
                    );

                  return {
                    page,
                    elements:
                      buildEventElementTree(
                        response.data || []
                      ),
                  };
                } catch {
                  return {
                    page,
                    elements: [],
                  };
                }
              }
            )
          );

        if (!cancelled) {
          setPageElements(
            results
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            'Не удалось загрузить элементы страниц'
          );

          setPageElements([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingElements(false);
        }
      }
    };

    loadElements();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    pages,
  ]);

  if (!isOpen) {
    return null;
  }

  // Переключает выбор элемента
  const toggleElement = (
    elementId
  ) => {
    setSelectedElementIds(
      (prev) =>
        prev.includes(elementId)
          ? prev.filter(
              (id) =>
                id !== elementId
            )
          : [
              ...prev,
              elementId,
            ]
    );
  };

  // Фильтрует дерево элементов по поиску
  const filterElementTree = (
    elements,
    search
  ) => {
    const term =
      search
        .trim()
        .toLowerCase();

    if (!term) {
      return elements;
    }

    return (
      elements || []
    ).reduce(
      (result, element) => {
        const nameMatches =
          String(
            element.name || ''
          )
            .toLowerCase()
            .includes(term);

        const children =
          filterElementTree(
            element.children || [],
            search
          );

        if (
          nameMatches ||
          children.length > 0
        ) {
          result.push({
            ...element,
            children,
          });
        }

        return result;
      },
      []
    );
  };

  // Проверяет страницу и её элементы по поиску
  const pageMatchesSearch = (
    page,
    elements,
    search
  ) => {
    const term =
      search
        .trim()
        .toLowerCase();

    if (!term) {
      return true;
    }

    if (
      String(
        page.title || ''
      )
        .toLowerCase()
        .includes(term)
    ) {
      return true;
    }

    const hasMatchingElement = (
      nodes
    ) =>
      (nodes || []).some(
        (element) =>
          String(
            element.name || ''
          )
            .toLowerCase()
            .includes(term) ||
          hasMatchingElement(
            element.children
          )
      );

    return hasMatchingElement(
      elements
    );
  };

  // Отображает дерево элементов события
  const renderEventElements = (
    elements,
    level = 0
  ) => {
    return (
      elements || []
    ).map(
      (element) => {
        const checked =
          selectedElementIds.includes(
            element.id
          );

        return (
          <div
            key={element.id}
          >
            <label
              className="flex items-center gap-2 py-1.5 cursor-pointer"
              style={{
                marginLeft: `${level * 18}px`,
                color:
                  colors.primary,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  toggleElement(
                    element.id
                  )
                }
                className="w-4 h-4"
              />

              <span>
                {element.name}
              </span>
            </label>

            {element.children?.length >
              0 &&
              renderEventElements(
                element.children,
                level + 1
              )}
          </div>
        );
      }
    );
  };

  const visiblePages =
    (
      pageElements || []
    ).reduce(
      (result, item) => {
        const filteredElements =
          filterElementTree(
            item.elements || [],
            elementSearch
          );

        if (
          pageMatchesSearch(
            item.page,
            item.elements,
            elementSearch
          )
        ) {
          result.push({
            ...item,
            elements:
              filteredElements,
          });
        }

        return result;
      },
      []
    );

  // Сохраняет новое или изменённое событие
  const handleSubmit =
    async (event) => {
      event.preventDefault();
      setError('');

      if (!title.trim()) {
        setError(
          'Введите название события'
        );

        return;
      }

      if (
        !topicId &&
        mode === 'irregular'
      ) {
        setError(
          'Выберите тему события'
        );

        return;
      }

      if (mode === 'regular') {
        if (!date) {
          setError(
            'Укажите дату события'
          );

          return;
        }

        if (!recurrence) {
          setError(
            'Укажите периодичность'
          );

          return;
        }
      }

      if (
        selectedElementIds.length ===
        0
      ) {
        setError(
          'Выберите хотя бы один элемент, к которому привязать событие'
        );

        return;
      }

      const payload = {
        event: {
          project_id:
            Number(projectId),
          name: title.trim(),
          event_type: mode,
          periodicity:
            mode === 'regular'
              ? recurrence
              : null,
          start_date:
            mode === 'regular'
              ? date
              : null,
          topic_id:
            mode === 'irregular'
              ? Number(topicId)
              : null,
        },
        element_ids:
          selectedElementIds,
      };

      try {
        setSaving(true);

        if (editingEvent) {
          await updateEvent(
            editingEvent.id,
            payload
          );
        } else {
          await createEvent(
            payload
          );
        }

        await onClose(true);
      } catch (saveError) {
        const detail =
          saveError.response?.data
            ?.detail;

        setError(
          typeof detail ===
            'string'
            ? detail
            : editingEvent
              ? 'Не удалось изменить событие'
              : 'Не удалось создать событие'
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        className="bg-white rounded-2xl p-6 w-[520px] max-w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          border:
            `1px solid ${colors.lightGray}`,
        }}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3
            className="text-xl font-semibold"
            style={{
              color:
                colors.primary,
            }}
          >
            {editingEvent
              ? 'Редактирование события'
              : mode === 'regular'
                ? 'Новое регулярное событие'
                : 'Новое нерегулярное событие'}
          </h3>

          <button
            type="button"
            onClick={() =>
              onClose(false)
            }
            className="cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 min-h-0"
        >
          <input
            type="text"
            placeholder="Название события"
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
            className="border rounded-md px-3 py-2"
            style={{
              borderColor:
                colors.lightGray,
              color:
                colors.black,
            }}
            required
          />

          {mode === 'regular' ? (
            <div className="grid grid-cols-2 gap-3">
              <select
                value={recurrence}
                onChange={(event) =>
                  setRecurrence(
                    event.target.value
                  )
                }
                className="border rounded-md px-3 py-2 bg-white"
                style={{
                  borderColor:
                    colors.lightGray,
                  color:
                    colors.black,
                }}
                required
              >
                <option value="ежегодно">
                  Ежегодно
                </option>

                <option value="ежемесячно">
                  Ежемесячно
                </option>

                <option value="раз в квартал">
                  Раз в квартал
                </option>

                <option value="еженедельно">
                  Еженедельно
                </option>
              </select>

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(
                    event.target.value
                  )
                }
                className="border rounded-md px-3 py-2"
                style={{
                  borderColor:
                    colors.lightGray,
                  color:
                    colors.black,
                }}
                required
              />
            </div>
          ) : (
            <select
              value={topicId}
              onChange={(event) =>
                setTopicId(
                  event.target.value
                )
              }
              className="border rounded-md px-3 py-2 bg-white"
              style={{
                borderColor:
                  colors.lightGray,
                color:
                  colors.black,
              }}
              required
            >
              <option value="">
                Выберите тему
              </option>

              {topics.map(
                (topic) => (
                  <option
                    key={topic.id}
                    value={topic.id}
                  >
                    {topic.name}
                  </option>
                )
              )}
            </select>
          )}

          <div
            className="px-4 py-2.5 rounded-lg text-sm"
            style={{
              backgroundColor:
                colors.blue,
              color:
                colors.primary,
              border:
                `1px solid ${colors.lightGray}`,
            }}
          >
            Выберите страницы и элементы,
            к которым привязать событие
          </div>

          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white"
            style={{
              border:
                `1px solid ${colors.lightGray}`,
            }}
          >
            <Search
              size={18}
              style={{
                color:
                  colors.secondaryText,
              }}
            />

            <input
              type="text"
              value={elementSearch}
              onChange={(event) =>
                setElementSearch(
                  event.target.value
                )
              }
              placeholder="Поиск страницы или элемента..."
              className="flex-1 outline-none border-none bg-transparent text-sm"
              style={{
                color:
                  colors.black,
              }}
            />
          </div>

          <div
            className="rounded-lg p-3 overflow-auto min-h-[150px] max-h-[300px]"
            style={{
              border:
                `1px solid ${colors.lightGray}`,
              backgroundColor:
                colors.white,
            }}
          >
            {loadingElements ? (
              <p
                className="text-center py-5 text-sm"
                style={{
                  color:
                    colors.secondaryText,
                }}
              >
                Загрузка страниц и
                элементов...
              </p>
            ) : visiblePages.length ===
              0 ? (
              <p
                className="text-center py-5 text-sm"
                style={{
                  color:
                    colors.secondaryText,
                }}
              >
                {pages.length === 0
                  ? 'В проекте пока нет страниц'
                  : 'Ничего не найдено'}
              </p>
            ) : (
              visiblePages.map(
                (item) => (
                  <div
                    key={
                      item.page.id
                    }
                    className="mb-3 last:mb-0"
                  >
                    <div
                      className="font-semibold text-sm py-1"
                      style={{
                        color:
                          colors.primary,
                      }}
                    >
                      {
                        item.page.title
                      }
                    </div>

                    {item.elements
                      .length ===
                    0 ? (
                      <div
                        className="text-sm py-1 pl-4"
                        style={{
                          color:
                            colors.secondaryText,
                        }}
                      >
                        Нет элементов
                      </div>
                    ) : (
                      renderEventElements(
                        item.elements
                      )
                    )}
                  </div>
                )
              )
            )}
          </div>

          {selectedElementIds.length >
            0 && (
            <div
              className="text-sm"
              style={{
                color:
                  colors.secondaryText,
              }}
            >
              Выбрано элементов:{' '}
              {
                selectedElementIds.length
              }
            </div>
          )}

          {error && (
            <div
              className="text-sm px-3 py-2 rounded-lg"
              style={{
                color:
                  '#b42318',
                backgroundColor:
                  '#fef3f2',
                border:
                  '1px solid #fecdca',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              saving ||
              loadingElements
            }
            className="text-white font-semibold py-2 rounded-xl mt-1"
            style={{
              backgroundColor:
                colors.primary,
              opacity:
                saving ||
                loadingElements
                  ? 0.6
                  : 1,
              cursor:
                saving ||
                loadingElements
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {saving
              ? 'Сохранение...'
              : editingEvent
                ? 'Сохранить'
                : 'Добавить'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Строит дерево элементов для модального окна события
function buildEventElementTree(list) {
  const source = list || [];

  const hasNestedChildren =
    source.some(
      (element) =>
        Array.isArray(
          element.children
        ) &&
        element.children.length > 0
    );

  if (hasNestedChildren) {
    return source.map(
      (element) => ({
        ...element,
        children:
          buildEventElementTree(
            element.children || []
          ),
      })
    );
  }

  const items = source.map(
    (element) => ({
      ...element,
      children: [],
    })
  );

  const byId = new Map(
    items.map(
      (element) => [
        element.id,
        element,
      ]
    )
  );

  const roots = [];

  items.forEach(
    (element) => {
      const parentId =
        element.parent_element_id ??
        element.parent_id ??
        null;

      const parent =
        parentId != null
          ? byId.get(parentId)
          : null;

      if (parent) {
        parent.children.push(
          element
        );
      } else {
        roots.push(element);
      }
    }
  );

  return roots;
}

// Управляет модальным окном тем
function TopicModal({
  projectId,
  isOpen,
  onClose,
  topics,
  onChanged,
}) {
  const [name, setName] =
    useState('');

  const [
    editingTopicId,
    setEditingTopicId,
  ] = useState(null);

  const [
    editingName,
    setEditingName,
  ] = useState('');

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEditingTopicId(null);
      setEditingName('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  // Создаёт новую тему
  const handleCreate =
    async (event) => {
      event.preventDefault();

      const trimmedName =
        name.trim();

      if (!trimmedName) {
        return;
      }

      try {
        setSaving(true);

        await createTopic({
          project_id:
            Number(projectId),
          name:
            trimmedName,
        });

        setName('');

        await onChanged?.();
      } catch (error) {
        const detail =
          error.response?.data
            ?.detail;

        alert(
          typeof detail ===
            'string'
            ? detail
            : 'Не удалось создать тему'
        );
      } finally {
        setSaving(false);
      }
    };

  // Открывает редактирование темы
  const handleStartEdit = (
    topic
  ) => {
    setEditingTopicId(
      topic.id
    );

    setEditingName(
      topic.name ?? ''
    );
  };

  // Отменяет редактирование темы
  const handleCancelEdit = () => {
    setEditingTopicId(null);
    setEditingName('');
  };

  // Сохраняет изменения темы
  const handleSaveEdit =
    async (topicId) => {
      const trimmedName =
        editingName.trim();

      if (!trimmedName) {
        return;
      }

      try {
        setSaving(true);

        await updateTopic(
          topicId,
          {
            name:
              trimmedName,
          }
        );

        setEditingTopicId(null);
        setEditingName('');

        await onChanged?.();
      } catch (error) {
        const detail =
          error.response?.data
            ?.detail;

        alert(
          typeof detail ===
            'string'
            ? detail
            : 'Не удалось изменить тему'
        );
      } finally {
        setSaving(false);
      }
    };

  // Удаляет тему
  const handleDelete = async (
    topic
  ) => {
    const confirmed =
      window.confirm(
        `Удалить тему «${topic.name}»?\n\nВсе события этой темы будут перемещены в «Без темы».`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      await deleteTopic(
        topic.id
      );

      await onChanged?.();
    } catch (error) {
      const detail =
        error.response?.data
          ?.detail;

      alert(
        typeof detail ===
          'string'
          ? detail
          : 'Не удалось удалить тему'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        className="bg-white rounded-2xl p-6 w-[430px] max-w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          border:
            `1px solid ${colors.lightGray}`,
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-xl font-semibold"
            style={{
              color:
                colors.primary,
            }}
          >
            Темы
          </h3>

          <button
            type="button"
            onClick={() =>
              onClose(false)
            }
            className="p-1 rounded hover:bg-gray-100 transition cursor-pointer"
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-5 max-h-[280px] overflow-y-auto">
          {topics.length === 0 ? (
            <div
              className="text-sm py-2"
              style={{
                color:
                  colors.secondaryText,
              }}
            >
              Тем пока нет
            </div>
          ) : (
            <ul className="space-y-1">
              {topics.map(
                (topic) => (
                  <li
                    key={
                      topic.id
                    }
                    className="flex items-center gap-2 py-1.5"
                  >
                    {editingTopicId ===
                    topic.id ? (
                      <>
                        <input
                          type="text"
                          value={
                            editingName
                          }
                          onChange={(
                            event
                          ) =>
                            setEditingName(
                              event.target
                                .value
                            )
                          }
                          onKeyDown={(
                            event
                          ) => {
                            if (
                              event.key ===
                              'Enter'
                            ) {
                              event.preventDefault();

                              handleSaveEdit(
                                topic.id
                              );
                            }

                            if (
                              event.key ===
                              'Escape'
                            ) {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          className="border rounded-md px-2 py-1 flex-1 min-w-0"
                          style={{
                            borderColor:
                              colors.lightGray,
                            color:
                              colors.primary,
                          }}
                          disabled={
                            saving
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            handleSaveEdit(
                              topic.id
                            )
                          }
                          className="p-1 rounded hover:text-green-600 transition cursor-pointer"
                          title="Сохранить"
                          disabled={
                            saving
                          }
                        >
                          ✓
                        </button>

                        <button
                          type="button"
                          onClick={
                            handleCancelEdit
                          }
                          className="p-1 rounded hover:text-red-500 transition cursor-pointer"
                          title="Отменить"
                          disabled={
                            saving
                          }
                        >
                          <X
                            size={16}
                          />
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="flex-1 min-w-0"
                          style={{
                            color:
                              colors.primary,
                          }}
                        >
                          •{' '}
                          {
                            topic.name
                          }
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleStartEdit(
                              topic
                            )
                          }
                          className="p-1 rounded hover:text-blue-600 transition cursor-pointer"
                          title="Редактировать тему"
                          disabled={
                            saving
                          }
                        >
                          <Pencil
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              topic
                            )
                          }
                          className="p-1 rounded hover:text-red-500 transition cursor-pointer"
                          title="Удалить тему"
                          disabled={
                            saving
                          }
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      </>
                    )}
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        <form
          onSubmit={
            handleCreate
          }
          className="flex gap-2 border-t pt-4"
          style={{
            borderColor:
              colors.lightGray,
          }}
        >
          <input
            type="text"
            placeholder="Новая тема"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            className="border rounded-md px-3 py-2 flex-1 min-w-0"
            style={{
              borderColor:
                colors.lightGray,
              color:
                colors.primary,
            }}
            disabled={saving}
          />

          <button
            type="submit"
            disabled={
              saving ||
              !name.trim()
            }
            className="text-white font-semibold px-4 py-2 rounded-xl transition"
            style={{
              backgroundColor:
                colors.primary,
              opacity:
                saving ||
                !name.trim()
                  ? 0.6
                  : 1,
              cursor:
                saving ||
                !name.trim()
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {saving
              ? 'Сохранение...'
              : 'Добавить'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProjectPage;