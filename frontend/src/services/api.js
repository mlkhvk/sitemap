import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Получает список проектов
export const getProjects = () => {
  return api.get('/projects');
};

// Создаёт новый проект
export const createProject = (data) => {
  return api.post('/projects', data);
};

// Удаляет проект
export const deleteProject = (projectId) => {
  return api.delete(`/projects/${projectId}`);
};

// Получает страницы проекта
export const getPages = (projectId) => {
  return api.get(`/projects/${projectId}/pages`);
};

// Создаёт новую страницу
export const createPage = (projectId, data) => {
  return api.post(
    `/projects/${projectId}/pages`,
    data
  );
};

// Обновляет страницу
export const updatePage = (pageId, data) => {
  return api.put(
    `/pages/${pageId}`,
    data
  );
};

// Удаляет страницу
export const deletePage = (pageId) => {
  return api.delete(
    `/pages/${pageId}`
  );
};

// Получает элементы страницы
export const getElements = (pageId) => {
  return api.get(
    `/pages/${pageId}/elements`
  );
};

// Создаёт элемент страницы
export const createElement = (
  pageId,
  data
) => {
  return api.post(
    `/pages/${pageId}/elements`,
    data
  );
};

// Обновляет элемент
export const updateElement = (
  elementId,
  data
) => {
  return api.put(
    `/elements/${elementId}`,
    data
  );
};

// Удаляет элемент
export const deleteElement = (
  elementId
) => {
  return api.delete(
    `/elements/${elementId}`
  );
};

// Получает события проекта
export const getEvents = (projectId, eventType = null) => {
  const params = {
    project_id: projectId,
  };

  if (eventType) {
    params.event_type = eventType;
  }

  return api.get('/events', {
    params,
  });
};

// Создаёт событие
export const createEvent = (
  data
) => {
  return api.post(
    '/events',
    data
  );
};

// Удаляет событие
export const deleteEvent = (
  eventId
) => {
  return api.delete(
    `/events/${eventId}`
  );
};

// Обновляет событие
export const updateEvent = (
  eventId,
  data
) => {
  return api.put(
    `/events/${eventId}`,
    data
  );
};

// Получает элементы, связанные с событием
export const getEventElementsByEvent = (
  eventId
) => {
  return api.get(
    `/events/${eventId}/elements`
  );
};

// Получает события элемента
export const getEventElements = (
  elementId
) => {
  return api.get(
    `/elements/${elementId}/events`
  );
};

// Привязывает событие к элементу
export const attachEventToElement = (
  elementId,
  eventId
) => {
  return api.post(
    `/elements/${elementId}/events/${eventId}`
  );
};

// Удаляет связь события с элементом
export const deleteEventElement = (
  elementId,
  eventId
) => {
  return api.delete(
    `/elements/${elementId}/events/${eventId}`
  );
};

// Получает темы проекта
export const getTopics = (projectId) => {
  return api.get('/topics', {
    params: {
      project_id: projectId,
    },
  });
};

// Создаёт тему
export const createTopic = (data) => {
  return api.post(
    '/topics',
    data
  );
};

// Обновляет тему
export const updateTopic = (
  topicId,
  data
) => {
  return api.put(
    `/topics/${topicId}`,
    data
  );
};

// Удаляет тему
export const deleteTopic = (
  topicId
) => {
  return api.delete(
    `/topics/${topicId}`
  );
};

// Получает список задач
export const getTasks = () => {
  return api.get('/tasks');
};

// Создаёт задачу
export const createTask = (
  data
) => {
  return api.post(
    '/tasks',
    data
  );
};

// Обновляет задачу
export const updateTask = (
  taskId,
  data
) => {
  return api.put(
    `/tasks/${taskId}`,
    data
  );
};

// Удаляет задачу
export const deleteTask = (
  taskId
) => {
  return api.delete(
    `/tasks/${taskId}`
  );
};

// Получает чеклист
export const getChecklist = () => {
  return api.get('/tasks/checklist');
};

export default api;