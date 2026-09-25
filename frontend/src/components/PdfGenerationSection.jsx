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
  formatMonthDay,
} from '../utils/eventHelpers';

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFontsModule from 'pdfmake/build/vfs_fonts';

const pdfFonts = pdfFontsModule.default || pdfFontsModule;
pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

// ============================================================
// TREE HELPERS
// ============================================================

const flattenPageTree = (tree) => {
  const result = [];

  const walk = (nodes) => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children?.length) walk(node.children);
    });
  };

  walk(tree);
  return result;
};

const buildElementTree = (elements) => {
  const map = {};

  elements.forEach((el) => {
    map[el.id] = { ...el, children: [] };
  });

  const tree = [];

  elements.forEach((el) => {
    if (el.parent_element_id && map[el.parent_element_id]) {
      map[el.parent_element_id].children.push(map[el.id]);
    } else {
      tree.push(map[el.id]);
    }
  });

  return tree;
};

const sortByOrderOrName = (items) =>
  [...items].sort((a, b) => {
    if (a.sort_order !== undefined && b.sort_order !== undefined) {
      return a.sort_order - b.sort_order;
    }
    return (a.name || a.title || '').localeCompare(b.name || b.title || '');
  });

const buildSitemapList = (nodes) => {
  const sorted = sortByOrderOrName(nodes);

  return sorted.map((node) => {
    const item = { text: node.title };
    if (node.children?.length) item.ul = buildSitemapList(node.children);
    return item;
  });
};

const buildElementsList = (nodes) => {
  const sorted = sortByOrderOrName(nodes);

  return sorted.map((node) => {
    const item = { text: node.name, bold: node.children?.length > 0 };
    if (node.children?.length) item.ul = buildElementsList(node.children);
    return item;
  });
};

// ============================================================
// COMPONENT
// ============================================================

function PdfGenerationSection({ project, pages, pageTree, events, topics }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // ------------------------------------------------------------
  // Сбор элементов каждой страницы + событий, привязанных к ним
  // ------------------------------------------------------------

  const collectPageEventData = async () => {
    const elementsByPageId = {};
    const eventsByElementId = {};
    const pagesByEventId = {};

    await Promise.all(
      pages.map(async (page) => {
        try {
          const res = await getElements(page.id);
          elementsByPageId[page.id] = res.data || [];
        } catch (err) {
          console.error(`Ошибка загрузки элементов страницы ${page.id}:`, err);
          elementsByPageId[page.id] = [];
        }
      })
    );

    const allElements = Object.entries(elementsByPageId).flatMap(
      ([pageId, elements]) =>
        elements.map((el) => ({ ...el, _pageId: Number(pageId) }))
    );

    await Promise.all(
      allElements.map(async (element) => {
        try {
          const res = await getEventElements(element.id);
          const elementEvents = res.data || [];
          eventsByElementId[element.id] = elementEvents;

          const page = pages.find((p) => p.id === element._pageId);

          elementEvents.forEach((event) => {
            if (!pagesByEventId[event.id]) pagesByEventId[event.id] = [];
            pagesByEventId[event.id].push({ page, element });
          });
        } catch (err) {
          console.error(`Ошибка загрузки событий элемента ${element.id}:`, err);
          eventsByElementId[element.id] = [];
        }
      })
    );

    return { elementsByPageId, eventsByElementId, pagesByEventId };
  };

  // ------------------------------------------------------------
  // Группировка событий (как в разделе "События" на ProjectPage)
  // ------------------------------------------------------------

  const getRegularGroups = () => {
    const groups = {};

    events
      .filter((event) => !isIrregularEvent(event))
      .forEach((event) => {
        const date = getEventDate(event);
        const recurrence = getEventRecurrence(event);
        if (!date || !recurrence) return;

        const key = `${date}_${recurrence}`;
        if (!groups[key]) groups[key] = { date, recurrence, items: [] };
        groups[key].items.push(event);
      });

    return Object.values(groups).sort((a, b) => compareMonthDay(a.date, b.date));
  };

  const getTopicName = (event) =>
    event.topic?.name ??
    topics.find((topic) => topic.id === event.topic_id)?.name ??
    'Без темы';

  // ------------------------------------------------------------
  // Раздел "Страницы сайта" (детально)
  // ------------------------------------------------------------

  const buildPagesDetailSection = (flatPages, elementsByPageId, eventsByElementId) => {
    const content = [];

    flatPages.forEach((page, index) => {
      const elements = elementsByPageId[page.id] || [];
      const elementTree = buildElementTree(elements);

      const regularLines = [];
      const irregularLines = [];

      elements.forEach((element) => {
        const elementEvents = eventsByElementId[element.id] || [];

        elementEvents.forEach((event) => {
          const title = getEventTitle(event);

          if (isIrregularEvent(event)) {
            irregularLines.push(`${element.name} - ${title}`);
          } else {
            const date = getEventDate(event);
            const recurrence = getEventRecurrence(event);
            const recurrenceLabel = RECURRENCE_LABELS[recurrence] || recurrence || '';
            const dateLabel = date ? formatMonthDay(date) : '';

            regularLines.push(
              `${element.name} - ${title} - ${recurrenceLabel}${dateLabel ? ` ${dateLabel}` : ''}`
            );
          }
        });
      });

      content.push({
        text: `${index + 1}. ${page.title}`,
        style: 'pageHeader',
        pageBreak: 'before',
      });

      if (page.links?.length) {
        content.push({
          text: [
            { text: 'Ссылки: ', bold: true },
            page.links.map((link) => link.url).join(', '),
          ],
          margin: [0, 0, 0, 8],
        });
      }

      if (elementTree.length) {
        content.push({ text: 'Содержание:', style: 'subHeader' });
        content.push({ ul: buildElementsList(elementTree), margin: [10, 0, 0, 10] });
      }

      content.push({ text: 'Данные, которые могут обновляться:', style: 'subHeader' });

      content.push({ text: 'Регулярно:', bold: true, margin: [10, 4, 0, 2] });
      content.push(
        regularLines.length
          ? { ul: regularLines, margin: [20, 0, 0, 8] }
          : { text: 'Нет регулярных событий', italics: true, color: '#888', margin: [20, 0, 0, 8] }
      );

      content.push({ text: 'При наступлении событий:', bold: true, margin: [10, 4, 0, 2] });
      content.push(
        irregularLines.length
          ? { ul: irregularLines, margin: [20, 0, 0, 8] }
          : { text: 'Нет нерегулярных событий', italics: true, color: '#888', margin: [20, 0, 0, 8] }
      );
    });

    return content;
  };

  // ------------------------------------------------------------
  // Раздел "Чеклисты событий"
  // ------------------------------------------------------------

  const buildChecklistsSection = (pagesByEventId) => {
    const content = [
      { text: 'Чеклисты событий', style: 'sectionHeader', pageBreak: 'before' },
      {
        text:
          'В этом разделе собраны чеклисты, пройдясь по которым можно ' +
          'гарантированно актуализировать всю необходимую информацию на ' +
          'сайте с минимальными трудозатратами.',
        margin: [0, 0, 0, 12],
      },
      { text: 'Регулярные события', style: 'subSectionHeader' },
      {
        text:
          'Чеклисты, привязанные к конкретным регулярным событиям, ' +
          'которые можно обозначить датой.',
        margin: [0, 0, 0, 10],
      },
    ];

    const regularGroups = getRegularGroups();

    if (regularGroups.length === 0) {
      content.push({ text: 'Регулярных событий пока нет', italics: true, color: '#888' });
    }

    regularGroups.forEach((group) => {
      const recurrenceLabel = RECURRENCE_LABELS[group.recurrence] || group.recurrence || '';

      content.push({
        text: `Чеклист – ${formatMonthDay(group.date)} (${recurrenceLabel})`,
        style: 'checklistHeader',
      });

      const pagesInGroup = {};

      group.items.forEach((event) => {
        (pagesByEventId[event.id] || []).forEach(({ page, element }) => {
          if (!page) return;
          if (!pagesInGroup[page.id]) pagesInGroup[page.id] = { page, lines: [] };
          pagesInGroup[page.id].lines.push(`${element.name} - ${getEventTitle(event)}`);
        });
      });

      const pageEntries = Object.values(pagesInGroup);

      if (pageEntries.length === 0) {
        content.push({
          text: 'Нет элементов, привязанных к этой дате',
          italics: true,
          color: '#888',
          margin: [10, 0, 0, 10],
        });
      } else {
        pageEntries.forEach((entry) => {
          content.push({ text: entry.page.title, bold: true, margin: [10, 4, 0, 2] });
          content.push({ ul: entry.lines.map((line) => `✓ ${line}`), margin: [20, 0, 0, 8] });
        });
      }
    });

    content.push({
      text: 'Нерегулярные события',
      style: 'subSectionHeader',
      pageBreak: 'before',
    });
    content.push({
      text:
        'Чеклисты, привязанные к конкретным событиям, которые могут ' +
        'произойти когда-угодно.',
      margin: [0, 0, 0, 10],
    });

    const irregularEvents = events.filter((event) => isIrregularEvent(event));

    if (irregularEvents.length === 0) {
      content.push({ text: 'Нерегулярных событий пока нет', italics: true, color: '#888' });
    }

    irregularEvents.forEach((event) => {
      content.push({
        text: `Чеклист – ${getEventTitle(event)} (${getTopicName(event)})`,
        style: 'checklistHeader',
      });

      const pagesInGroup = {};

      (pagesByEventId[event.id] || []).forEach(({ page, element }) => {
        if (!page) return;
        if (!pagesInGroup[page.id]) pagesInGroup[page.id] = { page, lines: [] };
        pagesInGroup[page.id].lines.push(element.name);
      });

      const pageEntries = Object.values(pagesInGroup);

      if (pageEntries.length === 0) {
        content.push({
          text: 'Нет элементов, привязанных к этому событию',
          italics: true,
          color: '#888',
          margin: [10, 0, 0, 10],
        });
      } else {
        pageEntries.forEach((entry) => {
          content.push({ text: entry.page.title, bold: true, margin: [10, 4, 0, 2] });
          content.push({ ul: entry.lines.map((line) => `✓ ${line}`), margin: [20, 0, 0, 8] });
        });
      }
    });

    return content;
  };

  // ------------------------------------------------------------
  // Генерация PDF
  // ------------------------------------------------------------

  const handleGeneratePdf = async () => {
    setError('');
    setGenerating(true);

    try {
      const { elementsByPageId, eventsByElementId, pagesByEventId } =
        await collectPageEventData();

      const flatPages = flattenPageTree(pageTree);

      const docDefinition = {
        pageMargins: [40, 60, 40, 60],
        defaultStyle: { font: 'Roboto', fontSize: 11 },
        styles: {
          coverTitle: { fontSize: 20, bold: true, margin: [0, 0, 0, 20] },
          sectionHeader: { fontSize: 18, bold: true, margin: [0, 0, 0, 14] },
          subSectionHeader: { fontSize: 15, bold: true, margin: [0, 10, 0, 8] },
          pageHeader: { fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
          subHeader: { fontSize: 12, bold: true, margin: [0, 6, 0, 4] },
          checklistHeader: { fontSize: 13, bold: true, margin: [0, 12, 0, 6] },
        },
        content: [
          {
            text: `Карта актуальности сайта – ${project?.name || ''}`,
            style: 'coverTitle',
          },
          {
            text:
              'Об инструменте: карта актуальности позволяет поддерживать ' +
              'актуальность сайта и своевременно вносить обновления.',
            margin: [0, 0, 0, 10],
          },
          { text: 'Как устроено:', bold: true, margin: [0, 0, 0, 6] },
          {
            ol: [
              'Раздел «Карта сайта» - общее понимание страниц и тематик контента',
              'Раздел «Страницы сайта» - детальное рассмотрение каждой страницы по содержанию контента, список динамических блоков',
              'Раздел «Чеклисты событий» - продуманные списки для регулярного обновления информации на всех страницах сайта',
            ],
            margin: [0, 0, 0, 10],
          },

          { text: 'Карта сайта', style: 'sectionHeader', pageBreak: 'before' },
          { ul: buildSitemapList(pageTree) },

          { text: 'Страницы сайта', style: 'sectionHeader', pageBreak: 'before' },
          { ol: flatPages.map((page) => page.title) },

          ...buildPagesDetailSection(flatPages, elementsByPageId, eventsByElementId),

          ...buildChecklistsSection(pagesByEventId),
        ],
      };

      const fileName = `Карта_актуальности_${project?.name || 'проект'}.pdf`;
      pdfMake.createPdf(docDefinition).download(fileName);
    } catch (err) {
      console.error('Ошибка генерации PDF:', err);
      setError('Не удалось сгенерировать PDF-файл');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <h3
        className="text-xl font-semibold mb-2 text-center"
        style={{ color: colors.primary }}
      >
        Генерация PDF
      </h3>

      <hr className="mb-4" style={{ borderColor: colors.lightGray }} />

      <p className="text-base mb-4" style={{ color: colors.text }}>
        Автоматически создаёт PDF-файл, включающий актуальную структуру сайта с
        подробными чеклистами для регулярных и нерегулярных событий.
      </p>

      <hr className="mb-4" style={{ borderColor: colors.lightGray }} />

      <div className="flex justify-center">
        <button
          onClick={handleGeneratePdf}
          disabled={generating}
          className="text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2"
          style={{
            backgroundColor: colors.lightBlue,
            opacity: generating ? 0.7 : 1,
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          <FileText size={18} />
          {generating ? 'Создание...' : 'Создать отчёт PDF'}
        </button>
      </div>

      {error && (
        <div
          className="text-sm px-3 py-2 rounded-lg mt-4 text-center"
          style={{ color: '#b42318', backgroundColor: '#fef3f2', border: '1px solid #fecdca' }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default PdfGenerationSection;