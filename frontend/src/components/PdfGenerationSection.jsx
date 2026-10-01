import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import colors from '../colors';
import { getElements, getEventElements } from '../services/api';

import {
  isIrregularEvent,
  getEventTitle,
  getEventDate,
  getEventRecurrence,
  RECURRENCE_LABELS,
  compareMonthDay,
} from '../utils/eventHelpers';

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFontsModule from 'pdfmake/build/vfs_fonts';

const pdfFonts = pdfFontsModule.default || pdfFontsModule;

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

// Нормализует URL страницы для определения вложенности
const normalizePagePath = (rawUrl) => {
  if (!rawUrl) {
    return '';
  }

  let path = '';

  try {
    const value = String(rawUrl);

    const parsed = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(value, 'http://pdf.local');

    path = parsed.pathname || '';
  } catch {
    path = String(rawUrl);
  }

  path = `/${path}`
    .replace(/\/{2,}/g, '/')
    .toLowerCase();

  if (path.length > 1) {
    path = path.replace(/\/+$/, '');
  }

  return path || '/';
};

// Получает первый URL страницы
const getFirstPagePath = (page) => {
  const link = page?.links?.find((item) => item?.url);

  return normalizePagePath(link?.url);
};

// Проверяет, является ли childPath вложенным относительно parentPath
const isNestedPagePath = (parentPath, childPath) => {
  if (!parentPath || !childPath || parentPath === childPath) {
    return false;
  }

  // Корневая страница "/" является родителем для всех страниц с непустым путём
  if (parentPath === '/') {
    return childPath !== '/';
  }

  return childPath.startsWith(`${parentPath}/`);
};

// Строит дерево страниц именно для PDF
const buildPdfPageTree = (pages = []) => {
  const items = pages.map((page) => ({
    ...page,
    children: [],
    _path: getFirstPagePath(page),
  }));

  const byId = new Map(
    items.map((item) => [item.id, item])
  );

  const tree = [];

  items.forEach((item) => {
    if (
      item.parent_page_id != null &&
      byId.has(item.parent_page_id)
    ) {
      byId
        .get(item.parent_page_id)
        .children.push(item);

      return;
    }

    let bestParent = null;

    items.forEach((candidate) => {
      if (candidate === item) {
        return;
      }

      if (
        candidate.parent_page_id != null &&
        !byId.has(candidate.parent_page_id)
      ) {
      }

      if (
        !candidate._path ||
        !item._path ||
        candidate._path === item._path
      ) {
        return;
      }

      if (
        !isNestedPagePath(
          candidate._path,
          item._path
        )
      ) {
        return;
      }

      if (
        !bestParent ||
        candidate._path.length > bestParent._path.length
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

// Нормализует узел элемента и рекурсивно восстанавливает его дочерние элементы
const normalizeElementNode = (node) => ({
  ...node,
  children: Array.isArray(node?.children)
    ? node.children.map(normalizeElementNode)
    : [],
});

// Преобразует дерево страниц в плоский список, сохраняя порядок вложенности
const flattenPageTree = (tree = []) => {
  const result = [];

  const walk = (nodes) => {
    (nodes || []).forEach((node) => {
      result.push(node);

      if (node?.children?.length) {
        walk(node.children);
      }
    });
  };

  walk(tree);
  return result;
};

// Строит дерево элементов страницы
const buildElementTree = (elements) => {
  const source = elements || [];

  const hasNestedChildren = source.some(
    (element) =>
      Array.isArray(element?.children) &&
      element.children.length > 0
  );

  if (hasNestedChildren) {
    return source.map(normalizeElementNode);
  }

  const map = new Map(
    source.map((element) => [
      element.id,
      {
        ...element,
        children: [],
      },
    ])
  );

  const tree = [];

  source.forEach((element) => {
    const current = map.get(element.id);

    if (!current) {
      return;
    }

    const parentId = element.parent_element_id;

    if (
      parentId != null &&
      map.has(parentId)
    ) {
      map.get(parentId).children.push(current);
    } else {
      tree.push(current);
    }
  });

  return tree;
};

const formatFullDate = (dateValue) => {
  if (!dateValue) {
    return '';
  }

  const raw = String(dateValue).trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (match) {
    const [, year, month, day] = match;
    const monthIndex = Number(month) - 1;

    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];

    if (months[monthIndex]) {
      return `${Number(day)} ${months[monthIndex]} ${year}`;
    }
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];

    return `${parsed.getDate()} ${
      months[parsed.getMonth()]
    } ${parsed.getFullYear()}`;
  }

  return raw;
};

// Сортирует элементы по порядку или названию
const sortByOrderOrName = (items = []) =>
  [...items].sort((a, b) => {
    if (
      a.sort_order !== undefined &&
      b.sort_order !== undefined
    ) {
      return a.sort_order - b.sort_order;
    }

    return (
      (a.name || a.title || '').localeCompare(
        b.name || b.title || '',
        'ru'
      )
    );
  });

// Формирует иерархический список страниц для PDF
const buildSitemapList = (nodes = [], level = 0) => {
  const result = [];

  sortByOrderOrName(nodes).forEach((node) => {
    const title = node.title || node.name || '';

    result.push({
      text: title,
      bold: false,
      margin: [level * 18, 0, 0, 4],
    });

    if (node.children?.length) {
      result.push(
        ...buildSitemapList(node.children, level + 1)
      );
    }
  });

  return result;
};

// Формирует иерархический список элементов для PDF
const buildElementsList = (nodes = [], level = 0) => {
  const result = [];

  sortByOrderOrName(nodes).forEach((node) => {
    const name = node.name || node.title || '';

    result.push({
      text: name,
      bold: node.children?.length > 0,
      margin: [level * 18, 0, 0, 4],
    });

    if (node.children?.length) {
      result.push(
        ...buildElementsList(node.children, level + 1)
      );
    }
  });

  return result;
};

const checkbox = {
  canvas: [
    {
      type: 'rect',
      x: 0,
      y: 1,
      w: 10,
      h: 10,
      lineWidth: 1,
    },
    {
      type: 'polyline',
      closePath: false,
      points: [
        { x: 2, y: 6 },
        { x: 4.5, y: 9 },
        { x: 9, y: 3 },
      ],
      lineWidth: 1.2,
    },
  ],
  width: 12,
  height: 12,
};

// Получает ссылки страницы в виде строки
const getPageUrl = (page) => {
  if (!page?.links?.length) {
    return '';
  }

  return page.links
    .map((link) => link.url)
    .filter(Boolean)
    .join(', ');
};

// Получает описание события
const getEventDescription = (event) => {
  return (
    event?.description ||
    event?.comment ||
    event?.details ||
    event?.text ||
    event?.note ||
    ''
  );
};

// Получает название темы события
const getTopicName = (event, topics) => {
  return (
    event?.topic?.name ||
    topics?.find(
      (topic) => topic.id === event?.topic_id
    )?.name ||
    'Без темы'
  );
};

// Получает название события для сортировки
const getEventSortName = (event) =>
  getEventTitle(event) || event?.name || '';

// Получает описание регулярного события
const getRegularDescription = (event) => {
  return (
    event?.description ||
    event?.comment ||
    event?.details ||
    event?.text ||
    ''
  );
};

// Убирает повторяющиеся значения из массива
const unique = (items) => [...new Set(items)];

// Группирует события по темам
const groupByTopic = (events, topics) => {
  const groups = {};

  events.forEach((event) => {
    const topicName = getTopicName(
      event,
      topics
    );

    if (!groups[topicName]) {
      groups[topicName] = [];
    }

    groups[topicName].push(event);
  });

  return Object.entries(groups).sort((a, b) =>
    a[0].localeCompare(b[0], 'ru')
  );
};

// Управляет генерацией PDF-отчёта
function PdfGenerationSection({
  project,
  pages,
  pageTree,
  events,
  topics,
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Собирает элементы страниц и связанные с ними события
  const collectPageEventData = async () => {
    const elementsByPageId = {};
    const eventsByElementId = {};
    const pagesByEventId = {};

    await Promise.all(
      (pages || []).map(async (page) => {
        try {
          const response = await getElements(page.id);

          elementsByPageId[page.id] =
            response.data || [];
        } catch {
          elementsByPageId[page.id] = [];
        }
      })
    );

    const allElements = Object.entries(
      elementsByPageId
    ).flatMap(([pageId, elements]) =>
      elements.map((element) => ({
        ...element,
        _pageId: Number(pageId),
      }))
    );

    await Promise.all(
      allElements.map(async (element) => {
        try {
          const response = await getEventElements(
            element.id
          );

          const elementEvents =
            response.data || [];

          eventsByElementId[element.id] =
            elementEvents;

          const page = pages.find(
            (item) => item.id === element._pageId
          );

          elementEvents.forEach((event) => {
            if (!pagesByEventId[event.id]) {
              pagesByEventId[event.id] = [];
            }

            pagesByEventId[event.id].push({
              page,
              element,
            });
          });
        } catch {
          eventsByElementId[element.id] = [];
        }
      })
    );

    return {
      elementsByPageId,
      eventsByElementId,
      pagesByEventId,
    };
  };

  // Формирует группы регулярных событий
  const getRegularGroups = () => {
    const groups = {};

    (events || [])
      .filter((event) => !isIrregularEvent(event))
      .forEach((event) => {
        const date = getEventDate(event);
        const recurrence =
          getEventRecurrence(event);

        if (!date || !recurrence) {
          return;
        }

        const key = `${date}_${recurrence}`;

        if (!groups[key]) {
          groups[key] = {
            date,
            recurrence,
            items: [],
          };
        }

        groups[key].items.push(event);
      });

    return Object.values(groups).sort((a, b) =>
      compareMonthDay(a.date, b.date)
    );
  };

  // Формирует заголовок страницы с её ссылкой
  const createPageTitle = (page, index) => {
    const url = getPageUrl(page);

    return {
      stack: [
        {
          text: `${index}. ${page.title || ''}`,
          style: 'pageTitle',
        },

        ...(url
          ? [
              {
                text: `(${url})`,
                style: 'pageUrl',
              },
            ]
          : []),
      ],
    };
  };

  // Формирует список страниц сайта
  const buildPagesListSection = (flatPages) => {
    return [
      {
        text: 'Страницы сайта',
        style: 'mainHeading',
        pageBreak: 'before',
      },

      {
        ol: flatPages.map(
          (page) => page.title || ''
        ),
        style: 'pageList',
      },
    ];
  };

  // Формирует подробную информацию о странице
  const buildPageDetail = (
    page,
    index,
    elementsByPageId,
    eventsByElementId
  ) => {
    const elements =
      elementsByPageId[page.id] || [];

    const elementTree =
      buildElementTree(elements);

    const regularByElement = {};
    const irregularByElement = {};

    elements.forEach((element) => {
      const elementEvents =
        eventsByElementId[element.id] || [];

      elementEvents.forEach((event) => {
        if (isIrregularEvent(event)) {
          if (!irregularByElement[element.id]) {
            irregularByElement[element.id] = [];
          }

          irregularByElement[element.id].push({
            element,
            event,
          });
        } else {
          if (!regularByElement[element.id]) {
            regularByElement[element.id] = [];
          }

          regularByElement[element.id].push({
            element,
            event,
          });
        }
      });
    });

    const regularItems = [];
    const irregularItems = [];

    Object.values(regularByElement)
      .flat()
      .forEach(({ element, event }) => {
        const date = getEventDate(event);
        const recurrence =
          getEventRecurrence(event);

        const recurrenceLabel =
          RECURRENCE_LABELS[recurrence] ||
          recurrence ||
          '';

        const dateLabel = date
          ? formatFullDate(date)
          : '';

        regularItems.push({
          element: element.name,
          event: getEventTitle(event),
          description:
            getRegularDescription(event),
          label:
            recurrenceLabel && dateLabel
              ? `${recurrenceLabel} ${dateLabel}`
              : recurrenceLabel || dateLabel,
        });
      });

    Object.values(irregularByElement)
      .flat()
      .forEach(({ element, event }) => {
        irregularItems.push({
          element: element.name,
          event: getEventTitle(event),
          description:
            getEventDescription(event),
        });
      });

    const content = [
      {
        stack: [
          {
            text: `${index}. ${
              page.title || ''
            }`,
            style: 'detailHeading',
          },

          ...(getPageUrl(page)
            ? [
                {
                  text: `(${getPageUrl(page)})`,
                  style: 'detailUrl',
                },
              ]
            : []),
        ],

        pageBreak: 'before',
      },
    ];

    if (page.links?.length) {
      content.push({
        text: 'Ссылки:',
        style: 'boldLabel',
        margin: [0, 0, 0, 2],
      });

      content.push({
        ul: page.links
          .map((link) => link.url)
          .filter(Boolean),
        style: 'linkList',
        margin: [18, 0, 0, 12],
      });
    }

    if (elementTree.length) {
      content.push({
        text: 'Содержание:',
        style: 'sectionLabel',
      });

      content.push({
        ul: buildElementsList(elementTree),
        style: 'elementList',
        margin: [18, 0, 0, 14],
      });
    }

    content.push({
      text: 'Данные, которые могут обновляться:',
      style: 'sectionLabel',
      margin: [0, 8, 0, 8],
    });

    content.push({
      text: 'Регулярно:',
      style: 'boldLabel',
      margin: [0, 0, 0, 5],
    });

    if (regularItems.length) {
      regularItems.forEach((item) => {
        content.push({
          text: [
            {
              text: `${item.element} – `,
              bold: false,
            },
            {
              text: item.event,
            },
            ...(item.label
              ? [
                  {
                    text: ` – ${item.label}`,
                  },
                ]
              : []),
          ],
          style: 'bulletText',
          margin: [18, 0, 0, 4],
        });
      });
    } else {
      content.push({
        text: 'Нет регулярных событий',
        style: 'emptyText',
        margin: [18, 0, 0, 8],
      });
    }

    content.push({
      text: 'При наступлении событий:',
      style: 'boldLabel',
      margin: [0, 10, 0, 5],
    });

    if (irregularItems.length) {
      irregularItems.forEach((item) => {
        content.push({
          stack: [
            {
              text: [
                {
                  text: `${item.element} – `,
                },
                {
                  text: item.event,
                },
              ],
            },

            ...(item.description
              ? [
                  {
                    text: `События: ${item.description}`,
                    style:
                      'eventDescriptionInline',
                  },
                ]
              : []),
          ],

          style: 'bulletText',
          margin: [18, 0, 0, 6],
        });
      });
    } else {
      content.push({
        text: 'Нет нерегулярных событий',
        style: 'emptyText',
        margin: [18, 0, 0, 8],
      });
    }

    return content;
  };

  // Формирует вводную часть раздела чеклистов
  const buildChecklistsIntro = () => {
    return [
      {
        text: 'Чеклисты событий',
        style: 'mainHeading',
        pageBreak: 'before',
      },

      {
        text:
          'В этом разделе собраны чеклисты, пройдясь по которым можно ' +
          'гарантированно актуализировать всю необходимую информацию на ' +
          'сайте с минимальными трудозатратами.',
        style: 'bodyText',
      },

      {
        text: 'Раздел состоит из 2 подразделов:',
        style: 'bodyText',
        margin: [0, 18, 0, 6],
      },

      {
        ol: [
          'Регулярные события',
          'Нерегулярные события',
        ],
        style: 'bodyText',
      },
    ];
  };

  // Формирует содержание раздела регулярных чеклистов
  const buildRegularChecklistIndex = () => {
    const groups = getRegularGroups();

    const list = groups.map((group) => {
      const date = formatFullDate(
        group.date
      );

      const recurrence =
        RECURRENCE_LABELS[group.recurrence] ||
        group.recurrence ||
        '';

      return recurrence
        ? `${date} – ${recurrence}`
        : date;
    });

    return [
      {
        text: 'Регулярные события – Чеклисты',
        style: 'mainHeading',
        pageBreak: 'before',
      },

      {
        text:
          'Здесь содержатся чеклисты, привязанные к конкретным регулярным ' +
          'событиям, которые можно обозначить датой. Каждая дата коротко ' +
          'пояснена сутью обновлений.',
        style: 'bodyText',
      },

      {
        text:
          'В чеклисте идёт сортировка по страницам с указанием места ' +
          'актуализации каждой из них.',
        style: 'bodyText',
        margin: [0, 10, 0, 18],
      },

      {
        text: 'Список регулярных обновлений:',
        style: 'boldLabel',
      },

      {
        ol: list,
        style: 'boldList',
        margin: [18, 4, 0, 0],
      },
    ];
  };

  // Формирует отдельный регулярный чеклист
  const buildRegularChecklistPage = (
    group,
    pagesByEventId
  ) => {
    const pageGroups = {};

    group.items.forEach((event) => {
      (
        pagesByEventId[event.id] || []
      ).forEach(({ page, element }) => {
        if (!page) return;

        if (!pageGroups[page.id]) {
          pageGroups[page.id] = {
            page,
            elements: [],
          };
        }

        pageGroups[page.id].elements.push({
          element,
          event,
        });
      });
    });

    const entries = Object.values(
      pageGroups
    );

    const recurrenceLabel =
      RECURRENCE_LABELS[group.recurrence] ||
      group.recurrence ||
      '';

    const content = [
      {
        text: `Чеклист – ${formatFullDate(
          group.date
        )}`,
        style: 'checklistHeading',
        pageBreak: 'before',
      },

      ...(recurrenceLabel
        ? [
            {
              text: `Периодичность: ${recurrenceLabel}`,
              style: 'bodyText',
              margin: [0, 0, 0, 12],
            },
          ]
        : []),
    ];

    const descriptionParts = unique(
      group.items
        .map((event) =>
          getRegularDescription(event)
        )
        .filter(Boolean)
    );

    if (descriptionParts.length) {
      content.push({
        text: descriptionParts.join(' '),
        style: 'italicText',
        margin: [0, 0, 0, 14],
      });
    }

    if (!entries.length) {
      content.push({
        text:
          'Нет элементов, привязанных к этой дате',
        style: 'emptyText',
      });

      return content;
    }

    entries.forEach((entry, index) => {
      const page = entry.page;

      content.push({
        text: `${index + 1}. ${
          page.title || ''
        }`,
        style: 'eventPageHeading',
        margin: [0, 12, 0, 3],
      });

      const url = getPageUrl(page);

      if (url) {
        content.push({
          text: `(${url})`,
          style: 'eventPageUrl',
          margin: [18, 0, 0, 5],
        });
      }

      entry.elements.forEach(
        ({ element, event }) => {
          content.push({
            columns: [
              checkbox,
              {
                text: [
                  {
                    text:
                      element.name || '',
                  },
                  {
                    text: event
                      ? ` – ${getEventTitle(
                          event
                        )}`
                      : '',
                  },
                ],
                style: 'checkItem',
              },
            ],

            columnGap: 6,
            margin: [18, 0, 0, 5],
          });
        }
      );
    });

    return content;
  };

  // Формирует содержание раздела нерегулярных чеклистов
  const buildIrregularChecklistIndex = () => {
    const irregularEvents = (
      events || []
    ).filter((event) =>
      isIrregularEvent(event)
    );

    const groups = groupByTopic(
      irregularEvents,
      topics
    );

    const content = [
      {
        text: 'Нерегулярные события – Чеклисты',
        style: 'mainHeading',
        pageBreak: 'before',
      },

      {
        text:
          'Здесь содержатся чеклисты, привязанные к конкретным событиям, ' +
          'которые могут произойти когда-угодно. Для каждого события ' +
          'коротко пояснена суть изменений. Сами события сгруппированы по ' +
          'темам для удобства поиска, в каждой теме наиболее вероятные ' +
          'события в начале списка.',
        style: 'bodyText',
      },

      {
        text:
          'В чеклисте идёт сортировка по страницам и для каждой указание ' +
          'места актуализации.',
        style: 'bodyText',
        margin: [0, 10, 0, 28],
      },

      {
        text: 'Список событий',
        style: 'listHeading',
        alignment: 'center',
      },
    ];

    groups.forEach(
      ([topicName, topicEvents]) => {
        content.push({
          text: `${topicName}:`,
          style: 'topicHeading',
          margin: [0, 8, 0, 3],
        });

        content.push({
          ol: topicEvents.map(
            (event) =>
              getEventSortName(event)
          ),
          style: 'bodyText',
          margin: [18, 0, 0, 10],
        });
      }
    );

    return content;
  };

  // Формирует отдельный нерегулярный чеклист
  const buildIrregularChecklistPage = (
    event,
    pagesByEventId
  ) => {
    const entriesByPage = {};

    (
      pagesByEventId[event.id] || []
    ).forEach(({ page, element }) => {
      if (!page) return;

      if (!entriesByPage[page.id]) {
        entriesByPage[page.id] = {
          page,
          elements: [],
        };
      }

      entriesByPage[page.id].elements.push(
        element
      );
    });

    const entries = Object.values(
      entriesByPage
    );

    const description =
      getEventDescription(event);

    const topicName = getTopicName(
      event,
      topics
    );

    const content = [
      {
        text: `Чеклист – ${getEventTitle(
          event
        )}`,
        style: 'checklistHeading',
        pageBreak: 'before',
      },

      {
        text: `Тема: ${topicName}`,
        style: 'bodyText',
        margin: [0, 0, 0, 10],
      },

      ...(description
        ? [
            {
              text: description,
              style: 'italicText',
              margin: [0, 0, 0, 16],
            },
          ]
        : []),
    ];

    if (!entries.length) {
      content.push({
        text:
          'Нет элементов, привязанных к этому событию',
        style: 'emptyText',
      });

      return content;
    }

    entries.forEach((entry, index) => {
      const page = entry.page;

      content.push({
        text: `${index + 1}. ${
          page.title || ''
        }`,
        style: 'eventPageHeading',
        margin: [0, 10, 0, 3],
      });

      const url = getPageUrl(page);

      if (url) {
        content.push({
          text: `(${url})`,
          style: 'eventPageUrl',
          margin: [18, 0, 0, 5],
        });
      }

      entry.elements.forEach(
        (element) => {
          content.push({
            columns: [
              checkbox,
              {
                text:
                  element.name || '',
                style: 'checkItem',
              },
            ],

            columnGap: 6,
            margin: [18, 0, 0, 5],
          });
        }
      );
    });

    return content;
  };

  // Формирует нижний колонтитул PDF
  const footer = (
    currentPage,
    pageCount
  ) => {
    return {
      columns: [
        {
          text: `${currentPage}`,
          alignment: 'center',
          fontSize: 9,
          color: '#444444',
        },
      ],

      margin: [0, 0, 0, 24],
    };
  };

  // Генерирует и скачивает PDF-файл
  const handleGeneratePdf = async () => {
    setError('');
    setGenerating(true);

    try {
      const {
        elementsByPageId,
        eventsByElementId,
        pagesByEventId,
      } = await collectPageEventData();

      const pdfPageTree =
        Array.isArray(pageTree) && pageTree.length
          ? pageTree
          : buildPdfPageTree(pages || []);

      const flatPages =
        flattenPageTree(pdfPageTree);

      const regularGroups =
        getRegularGroups();

      const irregularEvents = (
        events || []
      ).filter((event) =>
        isIrregularEvent(event)
      );

      const content = [];

      content.push({
        stack: [
          {
            text: `Карта актуальности сайта – ${
              project?.name || ''
            }`,
            style: 'coverHeading',
          },

          {
            text:
              'Об инструменте: карта актуальности позволяет поддерживать ' +
              'актуальность сайта и своевременно вносить обновления.',
            style: 'coverText',
          },

          {
            text: 'Как устроено:',
            style: 'coverLabel',
            margin: [0, 10, 0, 8],
          },

          {
            ol: [
              'Раздел «Карта сайта» - общее понимание страниц и тематик контента',
              'Раздел «Страницы сайта» - детальное рассмотрение каждой страницы по содержанию контента, список динамических блоков.',
              'Раздел «Чеклисты событий» - продуманные списки для регулярного обновления информации на всех страниц сайта.',
            ],
            style: 'coverText',
          },
        ],
      });

      content.push({
        text: 'Карта сайта',
        style: 'mainHeading',
        pageBreak: 'before',
      });

      content.push({
        ul: buildSitemapList(pdfPageTree),
        style: 'sitemap',
      });

      content.push(
        ...buildPagesListSection(
          flatPages
        )
      );

      flatPages.forEach(
        (page, index) => {
          content.push(
            ...buildPageDetail(
              page,
              index + 1,
              elementsByPageId,
              eventsByElementId
            )
          );
        }
      );

      content.push(
        ...buildChecklistsIntro()
      );

      content.push(
        ...buildRegularChecklistIndex()
      );

      regularGroups.forEach((group) => {
        content.push(
          ...buildRegularChecklistPage(
            group,
            pagesByEventId
          )
        );
      });

      content.push(
        ...buildIrregularChecklistIndex()
      );

      irregularEvents.forEach((event) => {
        content.push(
          ...buildIrregularChecklistPage(
            event,
            pagesByEventId
          )
        );
      });

      const docDefinition = {
        pageSize: 'A4',

        pageMargins: [
          72,
          72,
          72,
          48,
        ],

        defaultStyle: {
          font: 'Roboto',
          fontSize: 14,
          lineHeight: 1.32,
        },

        footer,

        styles: {
          coverHeading: {
            fontSize: 28,
            bold: false,
            margin: [0, 0, 0, 20],
          },

          coverText: {
            fontSize: 14,
            lineHeight: 1.32,
          },

          coverLabel: {
            fontSize: 14,
            bold: true,
          },

          mainHeading: {
            fontSize: 28,
            bold: false,
            margin: [0, 0, 0, 18],
          },

          detailHeading: {
            fontSize: 28,
            bold: false,
            margin: [0, 0, 0, 4],
          },

          checklistHeading: {
            fontSize: 28,
            bold: false,
            margin: [0, 0, 0, 18],
          },

          bodyText: {
            fontSize: 14,
            lineHeight: 1.32,
          },

          pageList: {
            fontSize: 14,
            lineHeight: 1.32,
          },

          sitemap: {
            fontSize: 14,
            lineHeight: 1.32,
          },

          elementList: {
            fontSize: 14,
            lineHeight: 1.32,
          },

          boldList: {
            fontSize: 14,
            bold: true,
            lineHeight: 1.32,
          },

          boldLabel: {
            fontSize: 14,
            bold: true,
          },

          sectionLabel: {
            fontSize: 14,
            bold: true,
            margin: [0, 8, 0, 4],
          },

          bulletText: {
            fontSize: 14,
            lineHeight: 1.32,
          },

          checkItem: {
            fontSize: 14,
            lineHeight: 1.32,
          },

          italicText: {
            fontSize: 14,
            italics: true,
            lineHeight: 1.32,
          },

          emptyText: {
            fontSize: 14,
            italics: true,
            color: '#888888',
          },

          pageTitle: {
            fontSize: 14,
            bold: false,
            margin: [0, 0, 0, 2],
          },

          pageUrl: {
            fontSize: 14,
            bold: false,
            margin: [0, 0, 0, 12],
          },

          detailUrl: {
            fontSize: 14,
            bold: false,
            margin: [0, 0, 0, 12],
          },

          linkList: {
            fontSize: 14,
          },

          eventPageHeading: {
            fontSize: 14,
            bold: true,
          },

          eventPageUrl: {
            fontSize: 14,
            bold: true,
          },

          eventDescriptionInline: {
            fontSize: 14,
            italics: false,
            margin: [0, 3, 0, 0],
          },

          listHeading: {
            fontSize: 20,
            bold: true,
            margin: [0, 0, 0, 12],
          },

          topicHeading: {
            fontSize: 14,
            bold: true,
          },
        },

        content,
      };

      const fileName = `Карта_актуальности_${
        project?.name || 'проект'
      }.pdf`;

      pdfMake
        .createPdf(docDefinition)
        .download(fileName);
    } catch {
      setError(
        'Не удалось сгенерировать PDF-файл'
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <h3
        className="text-2xl font-semibold mb-2 text-center"
        style={{
          color: colors.primary,
        }}
      >
        Генерация PDF
      </h3>

      <hr
        className="mb-4"
        style={{
          borderColor: colors.lightGray,
        }}
      />

      <p
        className="text-base mb-4"
        style={{
          color: colors.text,
        }}
      >
        Автоматически создаёт PDF-файл,
        включающий актуальную структуру сайта
        с подробными чеклистами для регулярных
        и нерегулярных событий.
      </p>

      <hr
        className="mb-4"
        style={{
          borderColor: colors.lightGray,
        }}
      />

      <div className="flex justify-center">
        <button
          onClick={handleGeneratePdf}
          disabled={generating}
          className="text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2"
          style={{
            backgroundColor:
              colors.lightBlue,
            opacity: generating ? 0.7 : 1,
            cursor: generating
              ? 'not-allowed'
              : 'pointer',
          }}
        >
          <FileText size={18} />

          {generating
            ? 'Создание...'
            : 'Создать отчёт PDF'}
        </button>
      </div>

      {error && (
        <div
          className="text-sm px-3 py-2 rounded-lg mt-4 text-center"
          style={{
            color: '#b42318',
            backgroundColor: '#fef3f2',
            border: '1px solid #fecdca',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default PdfGenerationSection;
