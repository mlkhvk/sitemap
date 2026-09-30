import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import colors from '../colors';
import {
  getPages,
  getElements,
  getProjects,
  getEventElements,
  getChecklist,
} from '../services/api';

// Форматирует дату для отображения
const formatDate = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
};

// Управляет отображением страницы и её данных
function PageDetail() {
  const { projectId, pageId } = useParams();
  const navigate = useNavigate();

  const [page, setPage] = useState(null);
  const [project, setProject] = useState(null);
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [regularItems, setRegularItems] = useState([]);
  const [irregularItems, setIrregularItems] = useState([]);

  useEffect(() => {
    fetchPageData();
  }, [pageId, projectId]);

  // Загружает данные страницы, проекта и элементов
  const fetchPageData = async () => {
    try {
      setLoading(true);

      const pagesRes = await getPages(projectId);

      const foundPage = pagesRes.data.find(
        (p) => p.id === parseInt(pageId)
      );

      setPage(foundPage);

      const projectsRes = await getProjects();

      const foundProject = projectsRes.data.find(
        (p) => p.id === parseInt(projectId)
      );

      setProject(foundProject);

      const elementsRes = await getElements(pageId);

      const pageElements = elementsRes.data || [];

      setElements(pageElements);

      await fetchEventsData(pageElements);
    } catch {
      return;
    } finally {
      setLoading(false);
    }
  };

  // Загружает события и чеклист для элементов страницы
  const fetchEventsData = async (pageElements) => {
    try {
      if (pageElements.length === 0) {
        setRegularItems([]);
        setIrregularItems([]);
        return;
      }

      const eventResults = await Promise.all(
        pageElements.map((el) =>
          getEventElements(el.id)
        )
      );

      const elementEventPairs = [];

      pageElements.forEach((el, idx) => {
        const events = eventResults[idx].data || [];

        events.forEach((event) => {
          elementEventPairs.push({
            element: el,
            event,
          });
        });
      });

      const checklistRes = await getChecklist();

      const tasksByEvent = {};

      (checklistRes.data || []).forEach((task) => {
        if (!tasksByEvent[task.event_id]) {
          tasksByEvent[task.event_id] = [];
        }

        tasksByEvent[task.event_id].push(task);
      });

      const regular = [];
      const irregular = [];

      elementEventPairs.forEach(
        ({ element, event }) => {
          const tasks =
            tasksByEvent[event.id] || [];

          const dueDates =
            tasks.length > 0
              ? tasks.map((t) => t.due_date)
              : [null];

          dueDates.forEach((dueDate) => {
            const item = {
              key: `${event.id}-${element.id}-${dueDate}`,
              label: element.name,
              eventName: event.name,
              dueDate,
            };

            if (event.event_type === 'regular') {
              regular.push({
                ...item,
                periodicity: event.periodicity,
              });
            } else {
              irregular.push(item);
            }
          });
        }
      );

      setRegularItems(regular);
      setIrregularItems(irregular);
    } catch {
      return;
    }
  };

  // Строит дерево элементов страницы
  const buildElementTree = (elements) => {
    const elementMap = {};

    elements.forEach((el) => {
      elementMap[el.id] = {
        ...el,
        children: [],
      };
    });

    const tree = [];

    elements.forEach((el) => {
      if (el.parent_element_id) {
        if (elementMap[el.parent_element_id]) {
          elementMap[
            el.parent_element_id
          ].children.push(
            elementMap[el.id]
          );
        }
      } else {
        tree.push(elementMap[el.id]);
      }
    });

    return tree;
  };

  // Отображает дерево элементов с учётом вложенности
  const renderElements = (
    items,
    level = 0,
    className = ''
  ) => {
    const sortedItems = [...items].sort(
      (a, b) => {
        if (
          a.sort_order !== undefined &&
          b.sort_order !== undefined
        ) {
          return (
            a.sort_order - b.sort_order
          );
        }

        return a.name.localeCompare(b.name);
      }
    );

    return sortedItems.map((el) => {
      const hasChildren =
        el.children &&
        el.children.length > 0;

      return (
        <div key={el.id}>
          <div
            className={`py-1 ${className}`}
            style={{
              paddingLeft: `${level * 20}px`,
              color: colors.primary,
            }}
          >
            {hasChildren ? (
              <span
                style={{
                  fontWeight: '600',
                }}
              >
                {el.name}
              </span>
            ) : (
              <span>
                {el.name}
              </span>
            )}
          </div>

          {hasChildren && (
            <div>
              {renderElements(
                el.children,
                level + 1,
                className
              )}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Загрузка...
      </div>
    );
  }

  if (!page) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p
            className="text-xl"
            style={{
              color: colors.primary,
            }}
          >
            Страница не найдена
          </p>

          <button
            onClick={() =>
              navigate(
                `/project/${projectId}`
              )
            }
            className="mt-4 px-4 py-2 rounded-lg text-white"
            style={{
              backgroundColor:
                colors.lightBlue,
            }}
          >
            Вернуться к проекту
          </button>
        </div>
      </div>
    );
  }

  const elementTree =
    buildElementTree(elements);

  const pageUrl =
    page.links &&
    page.links.length > 0
      ? page.links[0].url
      : '';

  return (
    <div className="min-h-screen p-3">
      <div
        className="rounded-2xl overflow-hidden border min-h-[95vh]"
        style={{
          borderColor: colors.lightGray,
          backgroundColor: colors.white,
        }}
      >
        <div
          className="p-6 border-b relative"
          style={{
            borderColor:
              colors.lightGray,
            backgroundColor:
              colors.background,
          }}
        >
          <button
            onClick={() =>
              navigate(
                `/project/${projectId}`
              )
            }
            className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Undo2
              size={28}
              style={{
                color: colors.primary,
              }}
            />
          </button>

          <h1
            className="text-3xl font-semibold text-center"
            style={{
              color: colors.primary,
            }}
          >
            {project?.name}
          </h1>
        </div>

        <div className="p-8 max-w-4xl mx-auto">
          <h1
            className="text-3xl font-semibold mb-6 text-center"
            style={{
              color: colors.primary,
            }}
          >
            {page.title}
          </h1>

          {page.links &&
            page.links.length > 0 && (
              <div className="mb-6">
                <span className="text-2xl">
                  Ссылки:
                </span>

                <div className="ml-12 mt-2 text-2xl">
                  {page.links.map(
                    (link, index) => (
                      <div
                        key={index}
                        style={{
                          color:
                            colors.primary,
                        }}
                      >
                        {link.url}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {elements.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl mb-4">
                Содержание:
              </h2>

              <div className="ml-12 mt-2 text-2xl">
                {renderElements(
                  elementTree,
                  0,
                  'text-2xl'
                )}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-2xl mb-4">
              Данные, которые могут
              обновляться:
            </h2>

            <div className="pl-4">
              <div className="mb-4">
                <span className="text-2xl">
                  Регулярно:
                </span>

                <div className="ml-12 mt-2 text-2xl">
                  {regularItems.length === 0 ? (
                    <div
                      style={{
                        color:
                          colors.secondaryText,
                      }}
                    >
                      Нет регулярных событий
                    </div>
                  ) : (
                    regularItems.map(
                      (item) => (
                        <div
                          key={item.key}
                          style={{
                            color:
                              colors.primary,
                          }}
                        >
                          • {item.label}
                          {' - '}
                          {item.eventName}
                          {' - '}
                          {item.periodicity}

                          {item.dueDate
                            ? ` ${formatDate(
                                item.dueDate
                              )}`
                            : ''}
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              <div>
                <span className="text-2xl">
                  При наступлении событий:
                </span>

                <div className="ml-12 mt-2 text-2xl">
                  {irregularItems.length === 0 ? (
                    <div
                      style={{
                        color:
                          colors.secondaryText,
                      }}
                    >
                      Нет нерегулярных событий
                    </div>
                  ) : (
                    irregularItems.map(
                      (item) => (
                        <div
                          key={item.key}
                          style={{
                            color:
                              colors.primary,
                          }}
                        >
                          • {item.label}
                          {' - '}
                          {item.eventName}

                          {item.dueDate
                            ? ` - ${formatDate(
                                item.dueDate
                              )}`
                            : ''}
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageDetail;