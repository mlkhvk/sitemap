import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, SlidersHorizontal, Check } from 'lucide-react';
import colors from '../colors';
import { getElements, getEventElements } from '../services/api';
import {
  isIrregularEvent,
  getEventTitle,
  getEventDate,
  getEventRecurrence,
  RECURRENCE_LABELS,
} from '../utils/eventHelpers';

// Строит дерево элементов из списка
const buildElementTree = (list) => {
  const source = list || [];

  const hasNested = source.some(
    (el) => Array.isArray(el.children) && el.children.length > 0
  );

  if (hasNested) {
    return source.map((el) => ({
      ...el,
      children: buildElementTree(el.children),
    }));
  }

  const byId = new Map(
    source.map((el) => [el.id, { ...el, children: [] }])
  );

  const roots = [];

  byId.forEach((node) => {
    const parentId = node.parent_element_id ?? node.parent_id ?? null;
    const parent = parentId != null ? byId.get(parentId) : null;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

const PERIODICITY_DAYS = {
  еженедельно: 7,
  weekly: 7,
  ежемесячно: 30,
  monthly: 30,
  'раз в квартал': 91,
  quarterly: 91,
  ежегодно: 365,
  yearly: 365,
};

// На сколько сдвигается дата при выполнении события
const PERIODICITY_SHIFT = {
  еженедельно: { days: 7 },
  weekly: { days: 7 },
  ежемесячно: { months: 1 },
  monthly: { months: 1 },
  'раз в квартал': { months: 3 },
  quarterly: { months: 3 },
  ежегодно: { months: 12 },
  yearly: { months: 12 },
};

// Разбирает дату формата ГГГГ-ММ-ДД
const parseIsoDate = (isoDate) => {
  if (!isoDate) return null;

  const parts = String(isoDate).split('-').map(Number);

  if (parts.length < 3 || parts.some(Number.isNaN)) {
    return null;
  }

  return parts;
};

// Сдвигает дату вперёд на период события
const addPeriod = (isoDate, recurrence) => {
  const parts = parseIsoDate(isoDate);
  const shift = PERIODICITY_SHIFT[recurrence];

  if (!parts || !shift) return null;

  const [year, month, day] = parts;

  if (shift.days) {
    return new Date(Date.UTC(year, month - 1, day + shift.days))
      .toISOString()
      .slice(0, 10);
  }

  const totalMonths = month - 1 + shift.months;
  const newYear = year + Math.floor(totalMonths / 12);
  const newMonth = totalMonths % 12;

  const daysInMonth = new Date(
    Date.UTC(newYear, newMonth + 1, 0)
  ).getUTCDate();

  const newDay = Math.min(day, daysInMonth);

  return new Date(Date.UTC(newYear, newMonth, newDay))
    .toISOString()
    .slice(0, 10);
};

// Считает количество дней от указанной даты до текущего дня
const daysSince = (isoDate) => {
  const parts = parseIsoDate(isoDate);

  if (!parts) return null;

  const [year, month, day] = parts;

  const target = Date.UTC(
    year,
    month - 1,
    day
  );

  const now = new Date();

  const today = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return Math.floor(
    (today - target) / 86400000
  );
};

// Проверяет, является ли регулярное событие просроченным
const isRowOverdue = (event, effectiveDate) => {
  if (isIrregularEvent(event)) return false;

  const date = effectiveDate ?? getEventDate(event);
  const recurrence = getEventRecurrence(event);
  const intervalDays = PERIODICITY_DAYS[recurrence];
  const diff = daysSince(date);

  if (diff === null || !intervalDays) return false;

  return diff > intervalDays;
};

// Форматирует дату для отображения
const formatDisplayDate = (isoDate) => {
  const parts = parseIsoDate(isoDate);

  if (!parts) return '';

  const [year, month, day] = parts;

  return `${day}.${String(month).padStart(2, '0')}.${year}`;
};

// Формирует подпись строки чеклиста
const buildRowLabel = (elementName, event) => {
  const title = getEventTitle(event);

  if (isIrregularEvent(event)) {
    return `${elementName} - ${title}`;
  }

  const recurrence = getEventRecurrence(event);

  const recurrenceLabel =
    RECURRENCE_LABELS[recurrence] ||
    recurrence ||
    '';

  return recurrenceLabel
    ? `${elementName} - ${recurrenceLabel} - ${title}`
    : `${elementName} - ${title}`;
};

// Отображает выпадающий фильтр по типу события
const TypeFilterDropdown = ({
  selected,
  onToggle,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, [open]);

  const options = [
    {
      id: 'regular',
      label: 'Регулярные',
    },
    {
      id: 'irregular',
      label: 'Нерегулярные',
    },
  ];

  return (
    <div
      ref={containerRef}
      className="relative flex-shrink-0"
    >
      <button
        type="button"
        onClick={() =>
          setOpen((prev) => !prev)
        }
        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
        style={{
          backgroundColor:
            selected.length > 0
              ? colors.primary
              : colors.blue,
          color:
            selected.length > 0
              ? colors.white
              : colors.primary,
          border: `1px solid ${
            selected.length > 0
              ? colors.primary
              : colors.lightGray
          }`,
        }}
        title="Фильтр по типу"
      >
        <SlidersHorizontal
          size={16}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-1 rounded-lg shadow-lg overflow-hidden"
          style={{
            border: `1px solid ${colors.lightGray}`,
            backgroundColor: colors.white,
            minWidth: '160px',
          }}
        >
          {options.map((option) => {
            const isSelected =
              selected.includes(option.id);

            return (
              <div
                key={option.id}
                onClick={() =>
                  onToggle(option.id)
                }
                className="px-3 py-2.5 text-sm cursor-pointer transition-colors"
                style={{
                  backgroundColor: isSelected
                    ? colors.blue
                    : colors.white,
                  color: colors.black,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    colors.blue;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    isSelected
                      ? colors.blue
                      : colors.white;
                }}
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

// Отображает чеклисты элементов проекта
const ChecklistsSection = ({
  projectId,
  pages,
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] =
    useState('pending');

  const [search, setSearch] = useState('');

  const [typeFilter, setTypeFilter] =
    useState([]);

  const [doneIds, setDoneIds] =
    useState(() => new Set());

  // Сдвинутые даты выполненных событий: { [rowId]: 'ГГГГ-ММ-ДД' }
  const [dateOverrides, setDateOverrides] =
    useState({});

  const storageKey =
    `checklist_done_project_${projectId}`;

  const datesKey =
    `checklist_dates_project_${projectId}`;

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(
          storageKey
        );

      setDoneIds(
        new Set(
          raw
            ? JSON.parse(raw)
            : []
        )
      );
    } catch {
      setDoneIds(new Set());
    }

    try {
      const rawDates =
        window.localStorage.getItem(
          datesKey
        );

      setDateOverrides(
        rawDates
          ? JSON.parse(rawDates)
          : {}
      );
    } catch {
      setDateOverrides({});
    }
  }, [storageKey, datesKey]);

  // Переключает статус выполнения строки и сдвигает дату события
  const toggleDone = useCallback(
    (row) => {
      const willBeDone = !doneIds.has(row.id);

      const nextDone = new Set(doneIds);
      const nextDates = { ...dateOverrides };

      if (willBeDone) {
        nextDone.add(row.id);

        if (!row.isIrregular) {
          const shifted = addPeriod(
            row.baseDate,
            row.recurrence
          );

          if (shifted) {
            nextDates[row.id] = shifted;
          }
        }
      } else {
        nextDone.delete(row.id);
        delete nextDates[row.id];
      }

      setDoneIds(nextDone);
      setDateOverrides(nextDates);

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify([...nextDone])
        );

        window.localStorage.setItem(
          datesKey,
          JSON.stringify(nextDates)
        );
      } catch {
        // localStorage недоступен, состояние остаётся только в памяти
      }
    },
    [doneIds, dateOverrides, storageKey, datesKey]
  );

  // Загружает элементы всех страниц проекта и их события
  const loadRows = useCallback(
    async () => {
      setLoading(true);

      try {
        const perPage =
          await Promise.all(
            (pages || []).map(
              async (page) => {
                try {
                  const { data } =
                    await getElements(
                      page.id
                    );

                  const tree =
                    buildElementTree(
                      data || []
                    );

                  const flat = [];

                  // Обходит дерево элементов и собирает события
                  const walk =
                    async (nodes) => {
                      for (
                        const node of nodes
                      ) {
                        let events =
                          node.events;

                        if (
                          !Array.isArray(
                            events
                          )
                        ) {
                          try {
                            const res =
                              await getEventElements(
                                node.id
                              );

                            events =
                              res.data || [];
                          } catch {
                            events = [];
                          }
                        }

                        events.forEach(
                          (event) => {
                            flat.push({
                              id: `${node.id}:${event.id}`,
                              elementId:
                                node.id,
                              elementName:
                                node.name,
                              event,
                            });
                          }
                        );

                        await walk(
                          node.children ||
                            []
                        );
                      }
                    };

                  await walk(tree);

                  return flat;
                } catch {
                  return [];
                }
              }
            )
          );

        setRows(
          perPage.flat()
        );
      } finally {
        setLoading(false);
      }
    },
    [pages]
  );

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Переключает фильтр по типу события
  const toggleTypeFilter = useCallback((type) => {
    setTypeFilter((prev) => {
      if (prev.includes(type)) {
        return [];
      }

      return [type];
    });
  }, []);

  const visibleRows = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return rows
      .map((row) => {
        const irregular =
          isIrregularEvent(row.event);

        const baseDate = irregular
          ? ''
          : getEventDate(row.event);

        // Показываем сдвинутую дату, если событие выполнено
        const date = irregular
          ? ''
          : dateOverrides[row.id] ||
            baseDate;

        return {
          ...row,

          label: buildRowLabel(
            row.elementName,
            row.event
          ),

          baseDate,
          date,

          recurrence:
            getEventRecurrence(
              row.event
            ),

          isIrregular: irregular,

          done: doneIds.has(row.id),

          overdue: isRowOverdue(
            row.event,
            date
          ),
        };
      })
      .filter((row) => {
        if (typeFilter.length > 0) {
          const type =
            row.isIrregular
              ? 'irregular'
              : 'regular';

          if (
            !typeFilter.includes(
              type
            )
          ) {
            return false;
          }
        }

        // Вкладка «Все» не фильтрует по статусу

        if (
          activeTab === 'done' &&
          !row.done
        ) {
          return false;
        }

        if (
          activeTab === 'overdue' &&
          (row.done ||
            !row.overdue)
        ) {
          return false;
        }

        if (
          activeTab === 'pending' &&
          (row.done ||
            row.overdue)
        ) {
          return false;
        }

        if (term) {
          const haystack =
            `${row.label} ${formatDisplayDate(
              row.date
            )}`.toLowerCase();

          if (
            !haystack.includes(term)
          ) {
            return false;
          }
        }

        return true;
      });
  }, [
    rows,
    doneIds,
    dateOverrides,
    typeFilter,
    activeTab,
    search,
  ]);

  const tabs = [
    {
      id: 'all',
      label: 'Все',
    },
    {
      id: 'pending',
      label: 'Не выполнено',
    },
    {
      id: 'done',
      label: 'Выполнено',
    },
    {
      id: 'overdue',
      label: 'Просрочено',
    },
  ];

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: colors.blue,
        border: `1px solid ${colors.lightGray}`,
      }}
    >
      <div className="flex gap-2 mb-3">
        {tabs.map((tab) => {
          const isActive =
            activeTab === tab.id;

          const textColor =
            tab.id === 'overdue'
              ? colors.error
              : colors.primary;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(tab.id)
              }
              className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{
                backgroundColor:
                  isActive
                    ? colors.white
                    : 'transparent',

                border: `1px solid ${
                  isActive
                    ? colors.lightGray
                    : 'transparent'
                }`,

                color: textColor,

                fontWeight:
                  isActive
                    ? 600
                    : 500,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="rounded-lg p-3"
        style={{
          border: `1px solid ${colors.lightGray}`,
          backgroundColor: colors.white,
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white mb-3"
          style={{
            border: `1px solid ${colors.lightGray}`,
          }}
        >
          <Search
            size={18}
            style={{
              color: colors.secondaryText,
            }}
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Поиск.."
            className="flex-1 outline-none border-none bg-transparent text-sm"
            style={{
              color: colors.black,
            }}
          />

          <TypeFilterDropdown
            selected={typeFilter}
            onToggle={toggleTypeFilter}
          />
        </div>

        <div className="max-h-[280px] overflow-auto">
          {loading ? (
            <p
              className="text-center py-5 text-sm"
              style={{
                color:
                  colors.secondaryText,
              }}
            >
              Загрузка...
            </p>
          ) : visibleRows.length === 0 ? (
            <p
              className="text-center py-5 text-sm"
              style={{
                color:
                  colors.secondaryText,
              }}
            >
              Ничего не найдено
            </p>
          ) : (
            visibleRows.map((row) => {
              const isAllTab =
                activeTab === 'all';

              const labelColor =
                isAllTab &&
                row.overdue &&
                !row.done
                  ? colors.error
                  : colors.primary;

              return (
                <div
                  key={row.id}
                  className="flex items-start gap-2 py-1"
                >
                  <span
                    className="text-sm font-semibold flex-shrink-0"
                    style={{
                      color:
                        colors.primary,
                    }}
                  >
                    {row.isIrregular
                      ? 'Н'
                      : 'Р'}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      toggleDone(row)
                    }
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer transition-all mt-0.5"
                    style={{
                      backgroundColor:
                        row.done
                          ? colors.primary
                          : colors.white,

                      border: `1.5px solid ${
                        row.done
                          ? colors.primary
                          : colors.secondaryText
                      }`,
                    }}
                    title={
                      row.done
                        ? 'Отметить невыполненным'
                        : 'Отметить выполненным'
                    }
                  >
                    {row.done && (
                      <Check
                        size={14}
                        strokeWidth={3}
                        color={
                          colors.white
                        }
                      />
                    )}
                  </button>

                  <span
                    className="text-sm flex-1"
                    style={{
                      color: labelColor,
                    }}
                  >
                    {row.label}
                  </span>

                  {row.date && (
                    <span
                      className="text-xs whitespace-nowrap flex-shrink-0 pt-0.5"
                      style={{
                        color:
                          colors.secondaryText,
                      }}
                    >
                      {formatDisplayDate(
                        row.date
                      )}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistsSection;