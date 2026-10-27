import { apiRequest } from './apiClient';

const queryString = values => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value);
  });
  return query.toString();
};

export const publicationsApi = {
  list: filters => apiRequest(`/admin/publications?${queryString(filters)}`),
  get: id => apiRequest(`/admin/publications/${id}`),
  preview: id => apiRequest(`/admin/publications/${id}/preview`),
  create: input => apiRequest('/admin/publications', { method: 'POST', body: input }),
  update: (id, input) => apiRequest(`/admin/publications/${id}`, { method: 'PATCH', body: input }),
  publish: (id, version) => apiRequest(`/admin/publications/${id}/publish`, { method: 'POST', body: { version } }),
  unpublish: (id, version) => apiRequest(`/admin/publications/${id}/unpublish`, { method: 'POST', body: { version } }),
  archive: id => apiRequest(`/admin/publications/${id}`, { method: 'DELETE' }),
};

export const categoriesApi = {
  list: filters => apiRequest(`/admin/categories?${queryString(filters || {})}`),
  create: input => apiRequest('/admin/categories', { method: 'POST', body: input }),
  update: (id, input) => apiRequest(`/admin/categories/${id}`, { method: 'PATCH', body: input }),
  remove: id => apiRequest(`/admin/categories/${id}`, { method: 'DELETE' }),
};
export const publicCategoriesApi = {
  list: kind => apiRequest(`/public/categories?${queryString({ kind })}`),
};

export const mediaApi = {
  list: filters => apiRequest(`/admin/media?${queryString(filters)}`),
  upload: formData => apiRequest('/admin/media', { method: 'POST', body: formData }),
  update: (id, input) => apiRequest(`/admin/media/${id}`, { method: 'PATCH', body: input }),
  usages: id => apiRequest(`/admin/media/${id}/usages`),
  remove: id => apiRequest(`/admin/media/${id}`, { method: 'DELETE' }),
};

export const heroApi = {
  list: () => apiRequest('/admin/hero-slides'),
  create: input => apiRequest('/admin/hero-slides', { method: 'POST', body: input }),
  update: (id, input) => apiRequest(`/admin/hero-slides/${id}`, { method: 'PATCH', body: input }),
  publish: (id, version) => apiRequest(`/admin/hero-slides/${id}/publish`, { method: 'POST', body: { version } }),
  unpublish: (id, version) => apiRequest(`/admin/hero-slides/${id}/unpublish`, { method: 'POST', body: { version } }),
  reorder: items => apiRequest('/admin/hero-slides/order', { method: 'PUT', body: { items } }),
  archive: id => apiRequest(`/admin/hero-slides/${id}`, { method: 'DELETE' }),
};

export const siteApi = {
  get: () => apiRequest('/admin/site'),
  updateOrganization: input => apiRequest('/admin/site/organization', { method: 'PATCH', body: input }),
  createContact: input => apiRequest('/admin/site/contacts', { method: 'POST', body: input }),
  updateContact: (id, input) => apiRequest(`/admin/site/contacts/${id}`, { method: 'PATCH', body: input }),
  deleteContact: id => apiRequest(`/admin/site/contacts/${id}`, { method: 'DELETE' }),
  updateBlock: (key, input) => apiRequest(`/admin/site/blocks/${key}`, { method: 'PUT', body: input }),
};

const createContentApi = resource => ({
  list: filters => apiRequest(`/admin/${resource}?${queryString(filters)}`),
  get: id => apiRequest(`/admin/${resource}/${id}`),
  preview: id => apiRequest(`/admin/${resource}/${id}/preview`),
  create: input => apiRequest(`/admin/${resource}`, { method: 'POST', body: input }),
  update: (id, input) => apiRequest(`/admin/${resource}/${id}`, { method: 'PATCH', body: input }),
  publish: (id, version) => apiRequest(`/admin/${resource}/${id}/publish`, { method: 'POST', body: { version } }),
  unpublish: (id, version) => apiRequest(`/admin/${resource}/${id}/unpublish`, { method: 'POST', body: { version } }),
  archive: id => apiRequest(`/admin/${resource}/${id}`, { method: 'DELETE' }),
});

export const storiesApi = createContentApi('stories');
export const projectsApi = createContentApi('projects');
export const pagesApi = createContentApi('pages');
export const childrenApi = createContentApi('children');

export const contentApis = { stories: storiesApi, projects: projectsApi, pages: pagesApi, children: childrenApi };
