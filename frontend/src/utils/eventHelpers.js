// Определяем, является ли событие нерегулярным.
export const isIrregularEvent = (event) => {
  // Если backend явно сказал, что событие регулярное
  if (event.is_regular === true) {
    return false;
  }

  // Если backend явно сказал, что событие нерегулярное
  if (event.is_regular === false) {
    return true;
  }

  if (
    event.event_type !== undefined &&
    event.event_type !== null
  ) {
    return event.event_type === 'irregular';
  }

  // Запасной вариант для старых данных
  return (
    (
      event.topic_id !== undefined &&
      event.topic_id !== null
    ) ||
    Boolean(event.topic)
  );
};

// Получение названия события.
export const getEventTitle = (event) => {
  return event.title ?? event.name ?? '';
};

// Получение даты события.
export const getEventDate = (event) => {
  return (
    event.date ??
    event.start_date ??
    event.event_date ??
    event.day ??
    event.at_date ??
    null
  );
};

// Получение периодичности.
export const getEventRecurrence = (event) => {
  return (
    event.recurrence ??
    event.repeat ??
    event.frequency ??
    event.periodicity ??
    null
  );
};

// Названия периодичности.
export const RECURRENCE_LABELS = {
  yearly: 'ежегодно',
  monthly: 'ежемесячно',
  weekly: 'еженедельно',
  quarterly: 'раз в квартал',
  'ежегодно': 'ежегодно',
  'ежемесячно': 'ежемесячно',
  'еженедельно': 'еженедельно',
  'раз в квартал': 'раз в квартал',
};

// Русские названия месяцев.
export const RU_MONTHS_GENITIVE = [
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

// ============================================================
// DATE HELPERS
// ============================================================

export const parseMonthDay = (dateStr) => {
  if (!dateStr) {
    return {
      month: 1,
      day: 1,
    };
  }

  const parts = String(dateStr)
    .split('-')
    .map(Number);

  // YYYY-MM-DD
  if (parts.length === 3) {
    return {
      month: parts[1],
      day: parts[2],
    };
  }

  // MM-DD
  if (parts.length === 2) {
    return {
      month: parts[0],
      day: parts[1],
    };
  }

  return {
    month: 1,
    day: 1,
  };
};

export const compareMonthDay = (a, b) => {
  const pa = parseMonthDay(a);
  const pb = parseMonthDay(b);

  return (
    pa.month - pb.month ||
    pa.day - pb.day
  );
};

export const formatMonthDay = (dateStr) => {
  const { day, month } = parseMonthDay(dateStr);
  return `${day} ${RU_MONTHS_GENITIVE[month - 1] || ''}`;
};