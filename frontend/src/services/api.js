import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});


// ============================================================
// PROJECTS
// ============================================================

export const getProjects = () => {
  return api.get('/projects');
};

export const createProject = (data) => {
  return api.post('/projects', data);
};

export const deleteProject = (projectId) => {
  return api.delete(`/projects/${projectId}`);
};


// ============================================================
// PAGES
// ============================================================

export const getPages = (projectId) => {
  return api.get(`/projects/${projectId}/pages`);
};

export const createPage = (projectId, data) => {
  return api.post(
    `/projects/${projectId}/pages`,
    data
  );
};

export const updatePage = (pageId, data) => {
  return api.put(
    `/pages/${pageId}`,
    data
  );
};

export const deletePage = (pageId) => {
  return api.delete(
    `/pages/${pageId}`
  );
};


// ============================================================
// ELEMENTS
// ============================================================

export const getElements = (pageId) => {
  return api.get(
    `/pages/${pageId}/elements`
  );
};

export const createElement = (
  pageId,
  data
) => {
  return api.post(
    `/pages/${pageId}/elements`,
    data
  );
};

export const updateElement = (
  elementId,
  data
) => {
  return api.put(
    `/elements/${elementId}`,
    data
  );
};

export const deleteElement = (
  elementId
) => {
  return api.delete(
    `/elements/${elementId}`
  );
};


// ============================================================
// EVENTS
// ============================================================

export const getEvents = () => {
  return api.get('events');
};

export const createEvent = (
  data
) => {
  return api.post(
    '/events',
    data
  );
};


// ============================================================
// EVENTS OF ELEMENT
// ============================================================

/**
 * Получить все события,
 * привязанные к элементу.
 *
 * GET:
 * /elements/{elementId}/events
 */
export const getEventElements = (
  elementId
) => {
  return api.get(
    `/elements/${elementId}/events`
  );
};



export const attachEventToElement = (
  elementId,
  eventId
) => {
  return api.post(
    `/elements/${elementId}/events/${eventId}`
  );
};

/**
 * Отвязать событие от элемента.
 *
 * DELETE:
 * /elements/{elementId}/events/{eventId}
 */
export const deleteEventElement = (
  elementId,
  eventId
) => {
  return api.delete(
    `/elements/${elementId}/events/${eventId}`
  );
};


// ============================================================
// TOPICS
// ============================================================

export const getTopics = () => {
  return api.get('/topics');
};

export const createTopic = (
  data
) => {
  return api.post(
    '/topics',
    data
  );
};


// ============================================================
// TASKS
// ============================================================

export const getTasks = () => {
  return api.get('/tasks');
};

export const createTask = (
  data
) => {
  return api.post(
    '/tasks',
    data
  );
};

export const updateTask = (
  taskId,
  data
) => {
  return api.put(
    `/tasks/${taskId}`,
    data
  );
};

export const deleteTask = (
  taskId
) => {
  return api.delete(
    `/tasks/${taskId}`
  );
};


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default api;