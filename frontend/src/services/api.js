import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getProjects = () => api.get('/projects');
export const createProject = (data) => api.post('/projects', data);
export const deleteProject = (projectId) => api.delete(`/projects/${projectId}`);
export const getPages = (projectId) => api.get(`/projects/${projectId}/pages`);
export const createPage = (projectId, data) => api.post(`/projects/${projectId}/pages`, data);
export const updatePage = (pageId, data) => api.put(`/pages/${pageId}`, data);
export const deletePage = (pageId) => api.delete(`/pages/${pageId}`);
export const getElements = (pageId) => api.get(`/pages/${pageId}/elements`);
export const createElement = (pageId, data) => api.post(`/pages/${pageId}/elements`, data);
export const updateElement = (elementId, data) => api.put(`/elements/${elementId}`, data);
export const deleteElement = (elementId) => api.delete(`/elements/${elementId}`);
export const getEvents = () => api.get('/events');
export const createEvent = (data) => api.post('/events', data);
export const getEventElements = (elementId) => api.get(`/elements/${elementId}/event_elements`);
export const createEventElement = (data) => api.post('/event_elements', data);
export const deleteEventElement = (eventElementId) => api.delete(`/event_elements/${eventElementId}`);
export const getTopics = () => api.get('/topics');
export const createTopic = (data) => api.post('/topics', data);
export const getTasks = () => api.get('/tasks');
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (taskId, data) => api.put(`/tasks/${taskId}`, data);

export default api;