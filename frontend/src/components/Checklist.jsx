import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import colors from '../colors';
import { getElements, getEventElements } from '../services/api';
import {
  isIrregularEvent,
  getEventTitle,
  getEventDate,
  getEventRecurrence,
  RECURRENCE_LABELS,
} from './ProjectPage';

// ============================================================
// ДЕРЕВО ЭЛЕМЕНТОВ (та же логика, что и в AddPageModal.jsx)
// ============================================================

const buildElementTree = (list) => {
  const source = list || [];
  const hasNested = source.some((el) => Array.isArray(el.children) && el.children.length > 0);
  if (hasNested) {
    return source.map((el) => ({ ...el, children: buildElementTree(el.children) }));
  }

  const byId = new Map(source.map((el) => [el.id, { ...el, children: [] }]));
  const roots = [];
  byId.forEach((node) => {
    const parentId = node.parent_element_id ?? node.parent_id ?? null;
    const parent = parentId != null ? byId.get(parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
};

// ============================================================
// ПРОСРОЧЕННОСТЬ РЕГУЛЯРНЫХ СОБЫТИЙ
// ============================================================

// Приблизительная длительность периода в днях.
// Упрощение: месяц = 30 дней, квартал = 91 день, год = 365 дней.
const PERIODICITY_DAYS = {
  'еженедельно': 7,
  weekly: 7,
  'ежемесячно': 30,
  monthly: 30,
  'раз в квартал': 91,
  quarterly: 91,
  'ежегодно': 365,
  yearly: 365,
};

const daysSince = (isoDate) => {
  if (!isoDate) return null;
  const parts = String(isoDate).split('-').map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  const target = Date.UTC(year, month - 1, day);

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.floor((today - target) / 86400000);
};

// Регулярное событие считается просроченным, если с даты его последнего
// наступления прошло больше одного периода (и оно не отмечено выполненным).
const isRowOverdue = (event) => {
  if (isIrregularEvent(event)) return false;

  const date = getEventDate(event);
  const recurrence = getEventRecurrence(event);
  const intervalDays = PERIODICITY_DAYS[recurrence];
  const diff = daysSince(date);

  if (diff === null || !intervalDays) return false;
  return diff > intervalDays;
};

// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const parts = String(isoDate).split('-').map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return '';
  const [year, month, day] = parts;
  return `${day}.${String(month).padStart(2, '0')}.${year}`;
};

const buildRowLabel = (elementName, event) => {
  const title = getEventTitle(event);

  if (isIrregularEvent(event)) {
    return `${elementName} - ${title}`;
  }

  const recurrence = getEventRecurrence(event);
  const recurrenceLabel = RECURRENCE_LABELS[recurrence] || recurrence || '';
  return recurrenceLabel ? `${elementName} - ${recurrenceLabel} - ${title}` : `${elementName} - ${title}`;
};

// ============================================================
// ФИЛЬТР ПО ТИПУ (Регулярные / Нерегулярные)
// ============================================================

const TypeFilterDropdown = ({ selected, onToggle }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const options = [
    { id: 'regular', label: 'Регулярные' },
    { id: 'irregular', label: 'Нерегулярные' },
  ];

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          backgroundColor: selected.length > 0 ? colors.primary : colors.lightGray,
          color: colors.white,
        }}
        title="Фильтр по типу"
      >
        <Filter size={13} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-1 rounded-lg shadow-lg overflow-hidden"
          style={{ border: `1px solid ${colors.lightGray}`, backgroundColor: colors.white, minWidth: '160px' }}
        >
          {options.map((option) => {
            const isSelected = selected.includes(option.id);
            return (
              <div
                key={option.id}
                onClick={() => onToggle(option.id)}
                className="px-3 py-2.5 text-sm cursor-pointer transition-colors"
                style={{
                  backgroundColor: isSelected ? colors.blue : colors.white,
                  color: colors.black,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.blue; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? colors.blue : colors.white; }}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================
// ЧЕКЛИСТЫ
// ============================================================

// projectId используется как ключ localStorage, pages — список страниц проекта (как в ProjectPage).
//
// ВАЖНО: отметка "выполнено" пока хранится только локально в браузере (localStorage),
// потому что в API нет поля для статуса выполнения по паре (элемент, событие).
// Если на бэкенде появится такое поле — эту часть нужно будет заменить на запросы к API,
// чтобы статус не терялся при переходе на другое устройство или очистке localStorage.
const ChecklistsSection = ({ projectId, pages }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'done' | 'overdue'
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]); // [] = показывать всё
  const [doneIds, setDoneIds] = useState(() => new Set());

  const storageKey = `checklist_done_project_${projectId}`;

  // Загрузка отметок "выполнено" из localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setDoneIds(new Set(raw ? JSON.parse(raw) : []));
    } catch (error) {
      console.error('Ошибка чтения отметок чеклиста:', error);
      setDoneIds(new Set());
    }
  }, [storageKey]);

  const toggleDone = useCallback((rowId) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);

      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch (error) {
        console.error('Ошибка сохранения отметок чеклиста:', error);
      }

      return next;
    });
  }, [storageKey]);

  // Загрузка элементов всех страниц проекта и их событий
  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const perPage = await Promise.all(
        (pages || []).map(async (page) => {
          try {
            const { data } = await getElements(page.id);
            const tree = buildElementTree(data || []);
            const flat = [];

            const walk = async (nodes) => {
              for (const node of nodes) {
                let events = node.events;
                if (!Array.isArray(events)) {
                  try {
                    const res = await getEventElements(node.id);
                    events = res.data || [];
                  } catch (error) {
                    console.error('Ошибка загрузки событий элемента:', error);
                    events = [];
                  }
                }

                events.forEach((event) => {
                  flat.push({
                    id: `${node.id}:${event.id}`,
                    elementId: node.id,
                    elementName: node.name,
                    event,
                  });
                });

                await walk(node.children || []);
              }
            };

            await walk(tree);
            return flat;
          } catch (error) {
            console.error(`Ошибка загрузки элементов страницы ${page.id}:`, error);
            return [];
          }
        })
      );

      setRows(perPage.flat());
    } finally {
      setLoading(false);
    }
  }, [pages]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const toggleTypeFilter = useCallback((type) => {
    setTypeFilter((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }, []);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows
      .map((row) => ({
        ...row,
        label: buildRowLabel(row.elementName, row.event),
        date: isIrregularEvent(row.event) ? '' : getEventDate(row.event),
        isIrregular: isIrregularEvent(row.event),
        done: doneIds.has(row.id),
        overdue: isRowOverdue(row.event),
      }))
      .filter((row) => {
        if (typeFilter.length > 0) {
          const type = row.isIrregular ? 'irregular' : 'regular';
          if (!typeFilter.includes(type)) return false;
        }

        if (activeTab === 'done' && !row.done) return false;
        if (activeTab === 'overdue' && (row.done || !row.overdue)) return false;
        if (activeTab === 'pending' && (row.done || row.overdue)) return false;

        if (term) {
          const haystack = `${row.label} ${formatDisplayDate(row.date)}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }

        return true;
      });
  }, [rows, doneIds, typeFilter, activeTab, search]);

  const tabs = [
    { id: 'pending', label: 'Не выполнено' },
    { id: 'done', label: 'Выполнено' },
    { id: 'overdue', label: 'Просрочено' },
  ];

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: colors.blue, border: `1px solid ${colors.lightGray}` }}
    >
      {/* Вкладки */}
      <div className="flex gap-2 mb-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const textColor = tab.id === 'overdue' ? colors.error : colors.primary;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{
                backgroundColor: isActive ? colors.white : 'transparent',
                border: `1px solid ${isActive ? colors.lightGray : 'transparent'}`,
                color: textColor,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Панель со списком */}
      <div className="rounded-lg p-3" style={{ border: `1px solid ${colors.lightGray}`, backgroundColor: colors.white }}>
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white mb-3"
          style={{ border: `1px solid ${colors.lightGray}` }}
        >
          <Search size={18} style={{ color: colors.secondaryText }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск.."
            className="flex-1 outline-none border-none bg-transparent text-sm"
            style={{ color: colors.black }}
          />
          <TypeFilterDropdown selected={typeFilter} onToggle={toggleTypeFilter} />
        </div>

        <div className="max-h-[280px] overflow-auto">
          {loading ? (
            <p className="text-center py-5 text-sm" style={{ color: colors.secondaryText }}>
              Загрузка...
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="text-center py-5 text-sm" style={{ color: colors.secondaryText }}>
              Ничего не найдено
            </p>
          ) : (
            visibleRows.map((row) => (
              <div key={row.id} className="flex items-start gap-2 py-1">
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: colors.primary }}>
                  {row.isIrregular ? 'Н' : 'Р'}
                </span>

                <span
                  onClick={() => toggleDone(row.id)}
                  className="cursor-pointer flex-shrink-0 leading-6"
                  style={{ color: colors.primary }}
                  title={row.done ? 'Отметить невыполненным' : 'Отметить выполненным'}
                >
                  •
                </span>

                <span className="text-sm flex-1" style={{ color: colors.primary }}>
                  {row.label}
                </span>

                {row.date && (
                  <span className="text-xs whitespace-nowrap flex-shrink-0 pt-0.5" style={{ color: colors.secondaryText }}>
                    {formatDisplayDate(row.date)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistsSection;